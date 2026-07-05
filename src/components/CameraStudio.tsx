/**
 * CameraStudio — full-screen camera overlay.
 * Opens device camera, lets user frame the shot, captures a high-quality JPEG,
 * then returns the data URL to the parent via onCapture.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, Check, Clock, Grid, RotateCcw, X, Zap } from './icons'

type Ratio = '1:1' | '4:5' | '9:16' | '16:9'
type FlashMode = 'auto' | 'on' | 'off'
type TimerDuration = 0 | 3 | 10
type ZoomLevel = 0.5 | 1 | 3

interface Props {
  onCapture: (imageDataUrl: string) => void
  onClose: () => void
}

const RATIOS: Ratio[] = ['1:1', '4:5', '9:16', '16:9']
const RATIO_ASPECT: Record<Ratio, string> = {
  '1:1': 'aspect-square', '4:5': 'aspect-[4/5]', '9:16': 'aspect-[9/16]', '16:9': 'aspect-video',
}
const RATIO_VALUE: Record<Ratio, number> = { '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16, '16:9': 16 / 9 }
const ZOOM_SCALE: Record<ZoomLevel, number> = { 0.5: 1, 1: 1.5, 3: 3 }
const FLASH_LABELS: Record<FlashMode, string> = { auto: 'Auto', on: 'On', off: 'Off' }
const TIMER_LABELS: Record<TimerDuration, string> = { 0: 'Off', 3: '3s', 10: '10s' }

const TIPS = ['Good lighting', 'Clean background', 'Center product', 'Avoid reflections', 'High resolution']

export default function CameraStudio({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [flash, setFlash] = useState<FlashMode>('auto')
  const [showGrid, setShowGrid] = useState(false)
  const [timerDuration, setTimerDuration] = useState<TimerDuration>(0)
  const [ratio, setRatio] = useState<Ratio>('4:5')
  const [zoom, setZoom] = useState<ZoomLevel>(1)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [permissionError, setPermissionError] = useState('')
  const [loading, setLoading] = useState(true)

  // In-app browsers (Instagram/Facebook/TikTok/LINE) commonly block camera
  // access outright with no permission prompt at all — retrying never helps,
  // the only fix is opening the link in a real browser. Detect this up front
  // so the error message actually tells the user something they can act on.
  const IN_APP_BROWSER = /FBAN|FBAV|Instagram|Line\/|TikTok|MicroMessenger/i.test(navigator.userAgent)

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    setLoading(true)
    setPermissionError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setLoading(false)
      setPermissionError(
        IN_APP_BROWSER
          ? "This app's built-in browser blocks camera access. Open this page in Chrome or Safari instead, or upload a photo."
          : "This browser doesn't support camera access. Try Chrome or Safari, or upload a photo instead.",
      )
      return
    }
    try {
      streamRef.current?.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setLoading(false)
      }
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      setHasMultipleCameras(devices.filter(d => d.kind === 'videoinput').length > 1)
    } catch (err) {
      setLoading(false)
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermissionError(
          IN_APP_BROWSER
            ? "Camera access was blocked. This app's built-in browser often can't grant it — open this page in Chrome or Safari, or upload a photo instead."
            : 'Camera access denied. Allow camera access in your browser settings and try again, or upload a photo instead.',
        )
      } else if (name === 'NotFoundError') {
        setPermissionError('No camera found on this device. Upload a photo instead.')
      } else {
        setPermissionError('Could not start the camera. Try again, or upload a photo instead.')
      }
    }
  }, [IN_APP_BROWSER])

  useEffect(() => {
    startCamera(facingMode)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function flipCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }

  function captureNow() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const { videoWidth, videoHeight } = video
    const targetRatio = RATIO_VALUE[ratio]
    const videoRatio = videoWidth / videoHeight

    let sx = 0, sy = 0, sw = videoWidth, sh = videoHeight
    if (videoRatio > targetRatio) {
      sw = videoHeight * targetRatio
      sx = (videoWidth - sw) / 2
    } else if (videoRatio < targetRatio) {
      sh = videoWidth / targetRatio
      sy = (videoHeight - sh) / 2
    }

    canvas.width = Math.round(sw)
    canvas.height = Math.round(sh)
    const ctx = canvas.getContext('2d')!

    if (facingMode === 'user') {
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      ctx.restore()
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    }

    setCaptured(canvas.toDataURL('image/jpeg', 0.95))
  }

  function handleShutter() {
    if (countdown !== null) return
    if (timerDuration === 0) { captureNow(); return }

    let count = timerDuration
    setCountdown(count)
    timerIntervalRef.current = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(timerIntervalRef.current!)
        timerIntervalRef.current = null
        setCountdown(null)
        captureNow()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  function retake() {
    setCaptured(null)
    startCamera(facingMode)
  }

  function useThisPhoto() {
    if (captured) { onCapture(captured); onClose() }
  }

  // Cycle helpers
  const cycleFlash = () => {
    const cycle: FlashMode[] = ['auto', 'on', 'off']
    setFlash(cycle[(cycle.indexOf(flash) + 1) % cycle.length])
  }
  const cycleTimer = () => {
    const cycle: TimerDuration[] = [0, 3, 10]
    setTimerDuration(cycle[(cycle.indexOf(timerDuration) + 1) % cycle.length])
  }
  const cycleRatio = () => {
    setRatio(RATIOS[(RATIOS.indexOf(ratio) + 1) % RATIOS.length])
  }

  const toolbar = [
    { label: FLASH_LABELS[flash], sub: 'Flash', onClick: cycleFlash, active: flash !== 'off', Icon: Zap },
    { label: showGrid ? 'On' : 'Off', sub: 'Grid', onClick: () => setShowGrid(g => !g), active: showGrid, Icon: Grid },
    { label: TIMER_LABELS[timerDuration], sub: 'Timer', onClick: cycleTimer, active: timerDuration > 0, Icon: Clock },
    { label: ratio, sub: 'Ratio', onClick: cycleRatio, active: false, Icon: Camera },
  ]

  // Video transform — mirrors front camera and applies zoom
  const videoStyle: React.CSSProperties = {
    transform: `scale(${ZOOM_SCALE[zoom]})${facingMode === 'user' ? ' scaleX(-1)' : ''}`,
    transformOrigin: 'center center',
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
          aria-label="Close camera"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-white">Take a Photo</span>
        <div className="h-9 w-9" aria-hidden />
      </div>

      {/* Main area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        {permissionError ? (
          /* Permission error state */
          <div className="max-w-xs rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
              <Camera className="h-8 w-8 text-white/40" />
            </div>
            <p className="text-sm font-semibold text-white">{permissionError}</p>
            <div className="mt-5 flex justify-center gap-2.5">
              <button
                onClick={() => startCamera(facingMode)}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="rounded-xl bg-fire-start px-4 py-2.5 text-sm font-semibold text-white hover:bg-fire-end transition-colors"
              >
                Upload a photo instead
              </button>
            </div>
          </div>
        ) : (
          /* Camera layout: toolbar | preview | zoom */
          <div className="flex w-full max-w-sm items-center gap-3 md:max-w-md">

            {/* Left vertical toolbar */}
            <div className="flex flex-col gap-2.5">
              {toolbar.map(({ label, sub, onClick, active, Icon }) => (
                <button
                  key={sub}
                  onClick={onClick}
                  className={`flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                    active ? 'bg-fire-start/25 text-fire-start ring-1 ring-fire-start/40' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  aria-label={`${sub}: ${label}`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-[9px] font-semibold leading-none">{label}</span>
                </button>
              ))}
            </div>

            {/* Camera preview box */}
            <div className={`relative flex-1 overflow-hidden rounded-2xl bg-void-900 ${RATIO_ASPECT[ratio]}`}>
              {captured ? (
                <img src={captured} alt="Captured" className="h-full w-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  style={videoStyle}
                />
              )}

              {/* Grid overlay */}
              {showGrid && !captured && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.12) 1px,transparent 1px)',
                    backgroundSize: '33.33% 33.33%',
                  }}
                />
              )}

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                  <span
                    className="font-black text-white"
                    style={{ fontSize: 'min(30vw, 120px)', textShadow: '0 0 40px rgba(0,0,0,0.8)' }}
                  >
                    {countdown}
                  </span>
                </div>
              )}

              {/* Loading overlay */}
              {loading && !captured && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}
            </div>

            {/* Right zoom controls */}
            <div className="flex flex-col gap-2">
              {([3, 1, 0.5] as ZoomLevel[]).map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                    zoom === z ? 'bg-fire-start text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  aria-label={`${z}x zoom`}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom controls */}
      {!permissionError && (
        <div className="flex-shrink-0 pb-safe">
          {/* Tips strip */}
          <div className="flex justify-center gap-3 px-4 pb-2 flex-wrap">
            {TIPS.map(tip => (
              <span key={tip} className="flex items-center gap-1 text-[10px] text-white/40">
                <Check className="h-2.5 w-2.5 text-fire-start/70" />
                {tip}
              </span>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between px-8 py-4">
            {/* Thumbnail / last capture */}
            <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
              {captured && <img src={captured} alt="" className="h-full w-full object-cover" />}
            </div>

            {/* Shutter or post-capture actions */}
            {captured ? (
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="rounded-full bg-white/15 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={useThisPhoto}
                  className="rounded-full bg-fire-start px-6 py-3 text-sm font-semibold text-white hover:bg-fire-end transition-colors shadow-fire-soft"
                >
                  Use this photo
                </button>
              </div>
            ) : (
              <button
                onClick={handleShutter}
                disabled={countdown !== null}
                className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-lg transition-transform hover:scale-95 active:scale-90 disabled:opacity-60"
                aria-label="Take photo"
              >
                <div className="h-[52px] w-[52px] rounded-full border-[2.5px] border-black/10 bg-white" />
              </button>
            )}

            {/* Flip camera */}
            <button
              onClick={flipCamera}
              disabled={!hasMultipleCameras || captured !== null}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
              aria-label="Switch camera"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
