import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import { ArrowRight, Check, Download, Plus, Spark, Wand } from '../components/icons'
import { startGeneration, pollUntilDone, type StatusResponse } from '../lib/api'
import { useSupabaseClient } from '../hooks/useSupabaseClient'
import { type SupabaseDb } from '../lib/supabase'
import { generator } from '../copy'

type Phase = 'idle' | 'working' | 'done' | 'error'

type Scene = {
  id: string              // local uuid (also used as Supabase id after insert)
  dbId: string | null     // supabase row id (null until persisted)
  label: string
  style: string
  phase: Phase
  videoUrl: string | null
  directorPrompt: string
  error: string
}

const SCENE_TEMPLATES = [
  { label: 'Hook',         style: 'fast-cut'    },
  { label: 'Product demo', style: 'unboxing'    },
  { label: 'Testimonial',  style: 'testimonial' },
  { label: 'Day-in-life',  style: 'day-in-life' },
  { label: 'Social proof', style: 'testimonial' },
  { label: 'CTA',          style: 'fast-cut'    },
]

function blankScene(label: string, style: string): Scene {
  return { id: crypto.randomUUID(), dbId: null, label, style, phase: 'idle', videoUrl: null, directorPrompt: '', error: '' }
}

export default function Studio() {
  const [params] = useSearchParams()
  const defaultStyle = params.get('style') || generator.styles[0].id
  const { user } = useUser()
  const getClient = useSupabaseClient()

  const [imageUrl, setImageUrl]     = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle]           = useState(defaultStyle)
  const [quality, setQuality]       = useState('turbo')
  const [stepIdx, setStepIdx]       = useState(0)

  const [scenes, setScenes] = useState<Scene[]>(
    SCENE_TEMPLATES.map((t) => blankScene(t.label, t.style)),
  )
  const [activeIdx, setActiveIdx] = useState(0)

  // Campaign row id — created on first generate, reused for all scenes.
  const campaignIdRef = useRef<string | null>(null)

  useEffect(() => { setStyle(defaultStyle) }, [defaultStyle])

  const activeScene = scenes[activeIdx]
  const busy = activeScene.phase === 'working'

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
      // 1. Ensure campaign row exists
      const db = await getClient()
      const campaignId = await upsertCampaign(db)

      // 2. Insert / upsert the scene row
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

      // 3. Call Claude director + video provider
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

      // 4. Poll until done
      const final: StatusResponse = await pollUntilDone(requestId, () => setStepIdx(2))

      if (final.status === 'completed' && final.videoUrl) {
        updateScene(idx, { phase: 'done', videoUrl: final.videoUrl })
        if (sceneDbId) {
          await db.from('scenes').update({ phase: 'done', video_url: final.videoUrl }).eq('id', sceneDbId)
        }
        // Mark campaign ready if this is the last scene
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
            <span>/</span>
            <span className="text-ink">New campaign</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Campaign Studio</h1>
        </div>
        <span className="eyebrow">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
          Live · Real Generation
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Brief form ── */}
        <div className="space-y-5">
          <form
            onSubmit={onGenerate}
            className="rounded-2xl border border-white/10 bg-void-900/60 p-6 shadow-card backdrop-blur-sm"
          >
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-ink-muted">Product brief</h2>

            <label className="block">
              <span className="text-sm font-semibold text-ink">{generator.fields.imageUrl.label}</span>
              <input
                type="url" required
                value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder={generator.fields.imageUrl.placeholder}
                className="mt-2 w-full rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-ink">{generator.fields.description.label}</span>
              <textarea
                required rows={2}
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={generator.fields.description.placeholder}
                className="mt-2 w-full resize-none rounded-xl border border-void-500 bg-void-800 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30"
              />
            </label>

            <div className="mt-4">
              <span className="text-sm font-semibold text-ink">Style</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {generator.styles.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyle(s.id)}
                    className={`rounded-xl border p-3 text-left transition-all duration-150 ${
                      style === s.id
                        ? 'border-gold/50 bg-gradient-fire-soft ring-1 ring-gold/30'
                        : 'border-white/5 bg-void-800 hover:bg-void-700'
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
                    className={`flex-1 rounded-xl border px-3 py-2 text-center transition-all duration-150 ${
                      quality === q.id
                        ? 'border-fire-start/50 bg-fire-start/10 text-ink'
                        : 'border-white/5 bg-void-800 text-ink-muted hover:bg-void-700'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{q.label}</span>
                    <span className="block text-[10px] text-ink-faint">{q.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-fire mt-6 w-full disabled:opacity-60">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Directing & rendering…
                </>
              ) : (
                <>
                  <Wand className="h-4 w-4" />
                  Generate scene {activeIdx + 1}
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-faint">{generator.note}</p>
          </form>
        </div>

        {/* ── Storyboard ── */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Storyboard</h2>
            <span className="text-xs text-ink-faint">
              {scenes.filter((s) => s.phase === 'done').length} / {scenes.length} scenes ready
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:gap-3">
            {scenes.map((scene, idx) => (
              <button key={scene.id} type="button" onClick={() => setActiveIdx(idx)}
                className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                  idx === activeIdx
                    ? 'border-fire-start/50 ring-2 ring-fire-start/20'
                    : 'border-white/8 hover:border-white/20'
                }`}
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-void-900">
                  {scene.phase === 'done' && scene.videoUrl ? (
                    <video src={scene.videoUrl} className="h-full w-full object-cover" autoPlay loop muted playsInline />
                  ) : scene.phase === 'working' ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-fire-start/30 border-t-fire-start" />
                      <span className="text-[11px] text-ink-faint">Rendering…</span>
                    </div>
                  ) : scene.phase === 'error' ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
                      <span className="text-xs text-fire-start">Failed</span>
                      <span className="text-[10px] text-ink-faint">{scene.error.slice(0, 60)}</span>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2">
                      {idx === activeIdx ? (
                        <><Spark className="h-6 w-6 text-fire-start" /><span className="text-[11px] text-ink-muted">Ready to generate</span></>
                      ) : (
                        <><Plus className="h-5 w-5 text-ink-faint" /><span className="text-[11px] text-ink-faint">Scene {idx + 1}</span></>
                      )}
                    </div>
                  )}
                  {scene.phase === 'done' && (
                    <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gradient-fire">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                </div>
                <div className="bg-void-900/80 px-3 py-2">
                  <p className="text-xs font-semibold text-ink">{scene.label}</p>
                  <p className="text-[10px] text-ink-faint capitalize">{scene.style.replace('-', ' ')}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Progress / result panel */}
          <AnimatePresence mode="wait">
            {activeScene.phase === 'working' && (
              <motion.div key="working" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-5 rounded-2xl border border-white/8 bg-void-900/60 p-5"
              >
                <div className="space-y-3">
                  {generator.steps.map((label, i) => {
                    const state = i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'todo'
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-white ${
                          state === 'done' ? 'bg-gradient-fire' : state === 'active' ? 'bg-fire-start/20 ring-1 ring-fire-start/40' : 'bg-void-600'
                        }`}>
                          {state === 'done' ? <Check className="h-3.5 w-3.5" />
                           : state === 'active' ? <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                           : <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />}
                        </span>
                        <span className={`text-sm ${state === 'todo' ? 'text-ink-faint' : 'text-ink'}`}>{label}</span>
                      </div>
                    )
                  })}
                </div>
                {activeScene.directorPrompt && (
                  <div className="mt-5 rounded-xl border border-white/5 bg-void-800 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">✦ Claude's direction</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{activeScene.directorPrompt}</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeScene.phase === 'done' && activeScene.videoUrl && (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-5 rounded-2xl border border-white/8 bg-void-900/60 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">Scene {activeIdx + 1}: {activeScene.label} — ready</p>
                    <p className="mt-1 text-xs text-ink-faint">Directed by Claude · rendered by Higgsfield · saved to Supabase</p>
                  </div>
                  <a href={activeScene.videoUrl} download target="_blank" rel="noreferrer"
                    className="btn-ghost gap-1.5 py-2 px-3 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
                <video src={activeScene.videoUrl} controls autoPlay loop playsInline
                  className="aspect-[9/16] max-h-96 w-full rounded-xl border border-gold/20 bg-black object-contain"
                />
                {activeIdx < scenes.length - 1 && (
                  <button type="button" onClick={() => setActiveIdx(activeIdx + 1)}
                    className="btn-ghost mt-4 w-full gap-2"
                  >
                    Generate scene {activeIdx + 2}: {scenes[activeIdx + 1]?.label}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  )
}
