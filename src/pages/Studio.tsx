import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import { ArrowRight, Bolt, Check, Download, Spark, Upload, Users, Wand } from '../components/icons'
import { startGeneration, pollUntilDone, type StatusResponse } from '../lib/api'
import { useSupabaseClient } from '../hooks/useSupabaseClient'
import { type SupabaseDb } from '../lib/supabase'
import { generator } from '../copy'

type Phase = 'idle' | 'working' | 'done' | 'error'

type Scene = {
  id: string
  dbId: string | null
  label: string
  style: string
  phase: Phase
  videoUrl: string | null
  directorPrompt: string
  error: string
}

const SCENE_TEMPLATES = [
  { label: 'Hook',         style: 'fast-cut',    duration: ':06', objective: 'Stop the scroll',     shotType: 'Wide · kinetic' },
  { label: 'Product Demo', style: 'unboxing',    duration: ':12', objective: 'Show it in action',   shotType: 'Close-up reveal' },
  { label: 'Testimonial',  style: 'testimonial', duration: ':15', objective: 'Build trust',          shotType: 'Face to camera' },
  { label: 'Day-in-Life',  style: 'day-in-life', duration: ':12', objective: 'Create desire',       shotType: 'Lifestyle b-roll' },
  { label: 'Social Proof', style: 'testimonial', duration: ':08', objective: 'Overcome objections', shotType: 'Face to camera' },
  { label: 'CTA',          style: 'fast-cut',    duration: ':05', objective: 'Drive the click',     shotType: 'Product + text' },
]

const STYLE_THEME: Record<string, { grad: string; accent: string }> = {
  'fast-cut':    { grad: 'linear-gradient(160deg, rgba(255,60,20,0.30) 0%, rgba(10,10,12,0.98) 55%)',   accent: '#FF3C14' },
  'unboxing':    { grad: 'linear-gradient(160deg, rgba(255,185,0,0.26) 0%, rgba(10,10,12,0.98) 55%)',   accent: '#FFB900' },
  'testimonial': { grad: 'linear-gradient(160deg, rgba(255,107,53,0.24) 0%, rgba(10,10,12,0.98) 55%)',  accent: '#FF6B35' },
  'day-in-life': { grad: 'linear-gradient(160deg, rgba(255,140,40,0.20) 0%, rgba(10,10,12,0.98) 55%)',  accent: '#FF8C28' },
}

const STYLE_ICON: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'fast-cut':    Bolt,
  'unboxing':    Upload,
  'testimonial': Users,
  'day-in-life': Spark,
}

function blankScene(label: string, style: string): Scene {
  return { id: crypto.randomUUID(), dbId: null, label, style, phase: 'idle', videoUrl: null, directorPrompt: '', error: '' }
}

export default function Studio() {
  const [params] = useSearchParams()
  const defaultStyle = params.get('style') || generator.styles[0].id
  const { user } = useUser()
  const getClient = useSupabaseClient()

  const [imageUrl, setImageUrl]       = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle]             = useState(defaultStyle)
  const [quality, setQuality]         = useState('turbo')
  const [stepIdx, setStepIdx]         = useState(0)

  const [scenes, setScenes] = useState<Scene[]>(
    SCENE_TEMPLATES.map((t) => blankScene(t.label, t.style)),
  )
  const [activeIdx, setActiveIdx] = useState(0)

  const campaignIdRef = useRef<string | null>(null)

  useEffect(() => { setStyle(defaultStyle) }, [defaultStyle])

  const activeScene = scenes[activeIdx]
  const busy = activeScene.phase === 'working'
  const doneCount = scenes.filter((s) => s.phase === 'done').length

  function updateScene(idx: number, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  async function upsertCampaign(db: SupabaseDb) {
    if (campaignIdRef.current) return campaignIdRef.current
    const { data, error } = await db
      .from('campaigns')
      .insert({
        user_id: user!.id,
        name: description.slice(0, 60) || 'Untitled Campaign',
        product_image_url: imageUrl.trim() || null,
        product_description: description.trim() || null,
        style,
        quality,
        status: 'rendering',
      })
      .select('id')
      .single()
    if (error || !data) throw new Error('Could not create campaign: ' + error?.message)
    campaignIdRef.current = data.id
    return data.id
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    const idx = activeIdx
    updateScene(idx, { phase: 'working', error: '', videoUrl: null, directorPrompt: '' })
    setStepIdx(0)

    try {
      const db = await getClient()
      const campaignId = await upsertCampaign(db)

      const scenePayload = {
        campaign_id: campaignId,
        user_id: user!.id,
        label: scenes[idx].label,
        style,
        order_index: idx,
        phase: 'working' as const,
      }
      const existing = scenes[idx].dbId
      let sceneDbId = existing
      if (!existing) {
        const { data } = await db.from('scenes').insert(scenePayload).select('id').single()
        sceneDbId = data?.id ?? null
        updateScene(idx, { dbId: sceneDbId })
      } else {
        await db.from('scenes').update({ phase: 'working', error_message: null, video_url: null }).eq('id', existing)
      }

      const { requestId, directorPrompt } = await startGeneration({
        productImageUrl: imageUrl.trim(),
        productDescription: description.trim(),
        style,
        quality,
      })
      updateScene(idx, { directorPrompt })
      if (sceneDbId) {
        await db.from('scenes').update({ director_prompt: directorPrompt, request_id: requestId }).eq('id', sceneDbId)
      }
      setStepIdx(2)

      const final: StatusResponse = await pollUntilDone(requestId, () => setStepIdx(2))

      if (final.status === 'completed' && final.videoUrl) {
        updateScene(idx, { phase: 'done', videoUrl: final.videoUrl })
        if (sceneDbId) {
          await db.from('scenes').update({ phase: 'done', video_url: final.videoUrl }).eq('id', sceneDbId)
        }
        const allDone = scenes.every((s, i) => i === idx || s.phase === 'done')
        if (allDone) {
          await db.from('campaigns').update({ status: 'ready' }).eq('id', campaignId)
        }
      } else {
        const msg = final.raw === 'timeout'
          ? 'Render timed out. Try again.'
          : 'Render did not complete. Try a different image or style.'
        updateScene(idx, { phase: 'error', error: msg })
        if (sceneDbId) {
          await db.from('scenes').update({ phase: 'error', error_message: msg }).eq('id', sceneDbId)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      updateScene(idx, { phase: 'error', error: msg })
    }
  }

  return (
    <AppShell>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center justify-between md:mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Link to="/dashboard" className="hover:text-ink transition-colors">Campaigns</Link>
            <span className="text-ink-faint">/</span>
            <span className="text-ink">New campaign</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Campaign Studio</h1>
        </div>
        <span className="eyebrow hidden sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
          Live · Real Generation
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">

        {/* ── Brief form ── */}
        <form onSubmit={onGenerate} className="space-y-4">

          {/* Region 1: Product Brief */}
          <div className="rounded-2xl border border-white/[0.07] bg-void-900/60 p-5 shadow-card backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint/70">01</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Product Brief</span>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-ink">{generator.fields.imageUrl.label}</span>
              <input
                type="url" required
                value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder={generator.fields.imageUrl.placeholder}
                className="mt-2 w-full rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-ink">{generator.fields.description.label}</span>
              <textarea
                required rows={3}
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={generator.fields.description.placeholder}
                className="mt-2 w-full resize-none rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30 transition-colors"
              />
            </label>
          </div>

          {/* Region 2: Style & Quality */}
          <div className="rounded-2xl border border-white/[0.07] bg-void-900/60 p-5 shadow-card backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint/70">02</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Style &amp; Quality</span>
            </div>

            <div>
              <span className="text-sm font-semibold text-ink">Style</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {generator.styles.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyle(s.id)}
                    className={`rounded-xl border p-3 text-left transition-all duration-150 ${
                      style === s.id
                        ? 'border-gold/50 bg-gradient-fire-soft ring-1 ring-gold/30'
                        : 'border-white/[0.06] bg-void-800 hover:bg-void-700 hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-ink">{s.label}</span>
                    <span className="mt-0.5 block text-[10px] text-ink-faint">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <span className="text-sm font-semibold text-ink">Quality</span>
              <div className="mt-2 flex gap-2">
                {generator.qualities.map((q) => (
                  <button key={q.id} type="button" onClick={() => setQuality(q.id)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-center transition-all duration-150 ${
                      quality === q.id
                        ? 'border-fire-start/50 bg-fire-start/10 text-ink'
                        : 'border-white/[0.06] bg-void-800 text-ink-muted hover:bg-void-700 hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{q.label}</span>
                    <span className="block text-[10px] text-ink-faint">{q.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Region 3: Generate */}
          <div className="rounded-2xl border border-white/[0.07] bg-void-900/60 p-5 shadow-card backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint/70">03</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">Generate</span>
            </div>

            <div className="mb-4 rounded-xl border border-white/[0.06] bg-void-800/60 p-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-fire-start/15">
                  <span className="text-[9px] font-bold text-fire-start">{activeIdx + 1}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">{SCENE_TEMPLATES[activeIdx].label}</p>
                  <p className="text-[11px] text-ink-faint">{SCENE_TEMPLATES[activeIdx].objective} · {SCENE_TEMPLATES[activeIdx].shotType}</p>
                </div>
                <span className="ml-auto rounded-lg bg-void-700/60 px-2 py-0.5 text-[10px] font-bold text-ink-faint">
                  {SCENE_TEMPLATES[activeIdx].duration}
                </span>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-fire w-full disabled:opacity-60">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Directing &amp; rendering…
                </>
              ) : (
                <>
                  <Wand className="h-4 w-4" />
                  Generate scene {activeIdx + 1}
                </>
              )}
            </button>
            <p className="mt-2.5 text-center text-[11px] text-ink-faint">{generator.note}</p>
          </div>
        </form>

        {/* ── Storyboard ── */}
        <div>
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Storyboard</h2>
              <p className="mt-0.5 text-xs text-ink-faint">
                {doneCount > 0 ? `${doneCount} of ${scenes.length} scenes ready` : `${scenes.length} scenes · click a frame to select`}
              </p>
            </div>
            {doneCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-24 overflow-hidden rounded-full bg-void-600">
                  <div
                    className="h-1 rounded-full bg-gradient-fire transition-all duration-700"
                    style={{ width: `${(doneCount / scenes.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-ink-faint">{Math.round((doneCount / scenes.length) * 100)}%</span>
              </div>
            )}
          </div>

          {/* Scene cards grid */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {scenes.map((scene, idx) => {
              const tpl = SCENE_TEMPLATES[idx]
              const theme = STYLE_THEME[tpl.style] ?? STYLE_THEME['testimonial']
              const SceneIcon = STYLE_ICON[tpl.style] ?? Spark
              const isActive = idx === activeIdx

              return (
                <motion.button
                  key={scene.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                    isActive
                      ? 'border-fire-start/60 ring-2 ring-fire-start/20 shadow-[0_0_24px_rgba(255,107,53,0.12)]'
                      : 'border-white/[0.08] hover:border-white/[0.18]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[9/16] w-full overflow-hidden"
                    style={{ background: scene.phase === 'idle' || scene.phase === 'error' ? theme.grad : '#0A0A0C' }}
                  >
                    {/* Noise texture overlay */}
                    {(scene.phase === 'idle') && (
                      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }}
                      />
                    )}

                    {/* Duration badge — top left */}
                    <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
                      <span className="text-[9px] font-bold tracking-wide text-white/90">{tpl.duration}</span>
                    </div>

                    {/* Scene number — top right */}
                    <div className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-black/60 backdrop-blur-sm">
                      <span className="text-[9px] font-bold text-white/90">{idx + 1}</span>
                    </div>

                    {/* Content area */}
                    {scene.phase === 'done' && scene.videoUrl ? (
                      <video src={scene.videoUrl} className="h-full w-full object-cover" autoPlay loop muted playsInline />
                    ) : scene.phase === 'working' ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-void-900">
                        <div className="relative">
                          <span className="h-8 w-8 animate-spin rounded-full border-2 border-fire-start/20 border-t-fire-start block" />
                          <SceneIcon className="absolute inset-0 m-auto h-3.5 w-3.5 text-fire-start/60" />
                        </div>
                        <span className="text-[10px] font-medium text-ink-faint">Rendering…</span>
                      </div>
                    ) : scene.phase === 'error' ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 bg-void-900 px-3 text-center">
                        <div className="rounded-lg bg-fire-start/10 p-2">
                          <span className="text-[10px] font-semibold text-fire-start">Failed</span>
                        </div>
                        <span className="text-[9px] leading-tight text-ink-faint">{scene.error.slice(0, 55)}</span>
                      </div>
                    ) : (
                      /* Empty / idle — cinematic frame */
                      <div className="flex h-full flex-col items-center justify-center gap-2">
                        <div className={`grid h-10 w-10 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'bg-fire-start/20 ring-1 ring-fire-start/40' : 'bg-white/[0.07]'
                        }`}
                          style={isActive ? {} : { boxShadow: `0 0 20px ${theme.accent}22` }}
                        >
                          <SceneIcon className={`h-5 w-5 ${isActive ? 'text-fire-start' : 'text-white/40'}`}
                            style={isActive ? {} : { color: `${theme.accent}99` }}
                          />
                        </div>
                        {isActive && (
                          <span className="text-[9px] font-semibold uppercase tracking-widest text-fire-start/80">
                            Ready
                          </span>
                        )}
                      </div>
                    )}

                    {/* Done check badge */}
                    {scene.phase === 'done' && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gradient-fire shadow-fire-soft">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}

                    {/* Bottom metadata overlay — shown on idle cards */}
                    {scene.phase === 'idle' && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2.5 pb-2.5 pt-6">
                        <p className="text-[9px] leading-tight text-white/50">{tpl.objective}</p>
                        <p className="text-[9px] leading-tight text-white/35">{tpl.shotType}</p>
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="border-t border-white/[0.06] bg-void-900/90 px-3 py-2">
                    <p className="text-[11px] font-semibold text-ink">{scene.label}</p>
                    <p className="text-[9px] capitalize text-ink-faint">{scene.style.replace(/-/g, ' ')}</p>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Progress / result panel */}
          <AnimatePresence mode="wait">
            {activeScene.phase === 'working' && (
              <motion.div
                key="working"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-void-900/60 shadow-card backdrop-blur-sm"
              >
                {/* Subtle fire glow header */}
                <div className="relative border-b border-white/[0.06] px-5 py-4">
                  <div className="pointer-events-none absolute inset-0 opacity-20"
                    style={{ background: 'linear-gradient(90deg, rgba(255,107,53,0.15) 0%, transparent 60%)' }}
                  />
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                    <p className="text-sm font-semibold text-ink">Claude is directing scene {activeIdx + 1}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">{SCENE_TEMPLATES[activeIdx].label} · {SCENE_TEMPLATES[activeIdx].objective}</p>
                </div>

                <div className="p-5 space-y-3">
                  {generator.steps.map((label, i) => {
                    const state = i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'todo'
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-white transition-all duration-300 ${
                          state === 'done'   ? 'bg-gradient-fire shadow-fire-soft' :
                          state === 'active' ? 'bg-fire-start/15 ring-1 ring-fire-start/50' :
                          'bg-void-600/60'
                        }`}>
                          {state === 'done'   ? <Check className="h-3.5 w-3.5" />
                          : state === 'active' ? <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                          : <span className="h-1.5 w-1.5 rounded-full bg-ink-faint/40" />}
                        </span>
                        <span className={`text-sm transition-colors duration-300 ${state === 'todo' ? 'text-ink-faint' : 'text-ink'}`}>{label}</span>
                        {state === 'active' && (
                          <span className="ml-auto text-[10px] font-semibold text-fire-start/70 animate-pulse">In progress</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {activeScene.directorPrompt && (
                  <div className="border-t border-white/[0.06] p-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold">✦ Claude's direction</p>
                    <p className="text-sm leading-relaxed text-ink-muted">{activeScene.directorPrompt}</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeScene.phase === 'done' && activeScene.videoUrl && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-void-900/60 shadow-card backdrop-blur-sm"
              >
                <div className="relative border-b border-white/[0.06] px-5 py-4">
                  <div className="pointer-events-none absolute inset-0 opacity-20"
                    style={{ background: 'linear-gradient(90deg, rgba(255,185,0,0.12) 0%, transparent 60%)' }}
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-fire">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                        <p className="text-sm font-semibold text-ink">Scene {activeIdx + 1} ready</p>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">Directed by Claude · rendered by Higgsfield · saved</p>
                    </div>
                    <a
                      href={activeScene.videoUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost gap-1.5 py-2 px-3 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                </div>

                <div className="p-5">
                  <video
                    src={activeScene.videoUrl}
                    controls autoPlay loop playsInline
                    className="aspect-[9/16] max-h-96 w-full rounded-xl border border-gold/20 bg-black object-contain"
                  />
                  {activeIdx < scenes.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveIdx(activeIdx + 1)}
                      className="btn-ghost mt-4 w-full gap-2"
                    >
                      Generate scene {activeIdx + 2}: {scenes[activeIdx + 1]?.label}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  )
}
