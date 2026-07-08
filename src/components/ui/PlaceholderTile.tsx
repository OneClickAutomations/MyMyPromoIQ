/**
 * PlaceholderTile — the single media placeholder used across every screen
 * (dashboard, discovery, storyboard, generation queue). Props-driven; never
 * rebuilt per screen. Renders without any data, so screens compose it freely.
 *
 * Tokens: elevated surface = void-700 (#161618), shimmer uses the config
 * `animate-shimmer` keyframe. No hardcoded hex.
 */
import { PlayIcon, Camera, Check, X, Info } from '../icons'

type Ratio = '9:16' | '16:9' | '1:1' | '3:4'
type Status = 'waiting' | 'generating' | 'complete' | 'failed'

const RATIO_CLASS: Record<Ratio, string> = {
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
  '1:1': 'aspect-square',
  '3:4': 'aspect-[3/4]',
}

export default function PlaceholderTile({
  ratio = '9:16',
  status = 'waiting',
  kind = 'video',
  src,
  label,
  className = '',
  children,
}: {
  ratio?: Ratio
  status?: Status
  /** 'video' shows a play glyph, 'image' a camera glyph, when there's no src. */
  kind?: 'video' | 'image'
  /** When present and complete, renders the real media instead of the glyph. */
  src?: string
  /** Small caption under the glyph (defaults to "Video"/"Image"). */
  label?: string
  className?: string
  /** Overlaid content (badges, actions) rendered above the surface. */
  children?: React.ReactNode
}) {
  const shimmer = status === 'generating'
  const failed = status === 'failed'
  const Glyph = kind === 'image' ? Camera : PlayIcon
  const caption = label ?? (kind === 'image' ? 'Image' : 'Video')

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${RATIO_CLASS[ratio]} ${
        failed ? 'bg-fire-end/[0.06] ring-1 ring-inset ring-fire-end/20' : 'bg-void-700'
      } ${shimmer ? 'animate-shimmer bg-gradient-to-r from-void-700 via-void-600 to-void-700 bg-[length:200%_100%]' : ''} ${className}`}
    >
      {status === 'complete' && src ? (
        kind === 'image'
          ? <img src={src} alt="" className="h-full w-full object-cover" />
          : <video src={src} muted loop autoPlay playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-1.5">
            {failed ? (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-fire-end/15">
                <Info className="h-5 w-5 text-fire-end/80" />
              </span>
            ) : (
              <Glyph className="h-8 w-8 text-white/20" />
            )}
            <span className="text-[11px] font-medium text-ink-faint">{caption}</span>
          </div>
        </div>
      )}

      {/* status corner badge */}
      {status === 'complete' && (
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-500/90 shadow-sm">
          <Check className="h-3.5 w-3.5 text-white" />
        </span>
      )}
      {status === 'failed' && (
        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-fire-end/90 shadow-sm">
          <X className="h-3.5 w-3.5 text-white" />
        </span>
      )}

      {children}
    </div>
  )
}
