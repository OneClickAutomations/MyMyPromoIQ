import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { generator } from '../copy'
import { ArrowRight, Wand, Download, Check, Spark } from './icons'
import Reveal from './Reveal'
import { startGeneration, pollUntilDone, type StatusResponse } from '../lib/api'

/**
 * The live generation flow — replaces the old static How-It-Works mock with the
 * real pipeline:
 *   client → POST /api/generate  (Claude directs + Higgsfield submit)
 *          → GET  /api/status    (poll until the video URL is ready)
 * Keys live server-side in netlify/functions; nothing secret touches this file.
 */
type Phase = 'idle' | 'working' | 'done' | 'error'

export default function Generator() {
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState(generator.styles[0].id)
  const [quality, setQuality] = useState('turbo')

  const [phase, setPhase] = useState<Phase>('idle')
  const [stepIdx, setStepIdx] = useState(0)
  const [directorPrompt, setDirectorPrompt] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const busy = phase === 'working'

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setPhase('working')
    setStepIdx(0)
    setError('')
    setVideoUrl(null)
    setDirectorPrompt('')

    try {
      // 1 + 2: Claude directs, job is submitted.
      const { requestId, directorPrompt } = await startGeneration({
        productImageUrl: imageUrl.trim(),
        productDescription: description.trim(),
        style,
        quality,
      })
      setDirectorPrompt(directorPrompt)
      setStepIdx(2) // now rendering

      // 3: poll until the render finishes.
      const final: StatusResponse = await pollUntilDone(requestId, () => setStepIdx(2))
      if (final.status === 'completed' && final.videoUrl) {
        setVideoUrl(final.videoUrl)
        setPhase('done')
      } else {
        setError(
          final.raw === 'timeout'
            ? 'The render is taking longer than expected. Try again in a moment.'
            : 'The render did not complete. Try a different image or style.',
        )
        setPhase('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('error')
    }
  }

  return (
    <section id="generate" className="relative py-28 md:py-36">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-fire-start/10 blur-[120px]" />

      <div className="container-x section-pad">
        <Reveal className="text-center">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-fire-start" />
            {generator.eyebrow}
          </span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl md:text-5xl">
            {generator.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-ink-muted">{generator.subtitle}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* ── Form ── */}
          <Reveal>
            <form
              onSubmit={onGenerate}
              className="rounded-2xl border border-white/10 bg-void-800 p-6 shadow-card md:p-7"
            >
              {/* image url */}
              <label className="block">
                <span className="text-sm font-semibold text-ink">{generator.fields.imageUrl.label}</span>
                <input
                  type="url"
                  required
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={generator.fields.imageUrl.placeholder}
                  className="mt-2 w-full rounded-xl border border-void-500 bg-void-700/60 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30"
                />
              </label>

              {/* description */}
              <label className="mt-5 block">
                <span className="text-sm font-semibold text-ink">{generator.fields.description.label}</span>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={generator.fields.description.placeholder}
                  className="mt-2 w-full resize-none rounded-xl border border-void-500 bg-void-700/60 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/30"
                />
              </label>

              {/* style */}
              <div className="mt-5">
                <span className="text-sm font-semibold text-ink">Style</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {generator.styles.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={`rounded-xl border p-3 text-left transition-all duration-150 ${
                        style === s.id
                          ? 'border-gold/50 bg-gradient-fire-soft ring-1 ring-gold/30'
                          : 'border-white/5 bg-void-700/40 hover:bg-void-700/70'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-ink">{s.label}</span>
                      <span className="mt-0.5 block text-[11px] text-ink-faint">{s.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* quality */}
              <div className="mt-5">
                <span className="text-sm font-semibold text-ink">Quality</span>
                <div className="mt-2 flex gap-2">
                  {generator.qualities.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setQuality(q.id)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-center transition-all duration-150 ${
                        quality === q.id
                          ? 'border-fire-start/50 bg-fire-start/10 text-ink'
                          : 'border-white/5 bg-void-700/40 text-ink-muted hover:bg-void-700/70'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{q.label}</span>
                      <span className="block text-[11px] text-ink-faint">{q.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={busy} className="btn-fire mt-7 w-full disabled:opacity-70">
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {generator.ctaBusy}
                  </>
                ) : (
                  <>
                    <Wand className="h-4 w-4" />
                    {generator.cta}
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-xs text-ink-faint">{generator.note}</p>
            </form>
          </Reveal>

          {/* ── Result panel ── */}
          <Reveal delay={0.08}>
            <div className="flex h-full min-h-[360px] flex-col rounded-2xl border border-white/10 bg-void-800 p-6 shadow-card md:p-7">
              <AnimatePresence mode="wait">
                {phase === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid flex-1 place-items-center text-center"
                  >
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-fire-soft ring-1 ring-fire-start/30">
                        <Spark className="h-6 w-6 text-fire-start" />
                      </div>
                      <p className="mt-4 max-w-xs text-sm text-ink-muted">
                        Your finished video shows up here. No timeline, no editor — just the output.
                      </p>
                    </div>
                  </motion.div>
                )}

                {phase === 'working' && (
                  <motion.div
                    key="working"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-1 flex-col"
                  >
                    <div className="space-y-3">
                      {generator.steps.map((label, i) => {
                        const state = i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'todo'
                        return (
                          <div key={label} className="flex items-center gap-3">
                            <span
                              className={`grid h-6 w-6 place-items-center rounded-full text-white ${
                                state === 'done'
                                  ? 'bg-gradient-fire'
                                  : state === 'active'
                                    ? 'bg-fire-start/20 ring-1 ring-fire-start/40'
                                    : 'bg-void-600'
                              }`}
                            >
                              {state === 'done' ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : state === 'active' ? (
                                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-fire-start" />
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
                              )}
                            </span>
                            <span
                              className={`text-sm ${state === 'todo' ? 'text-ink-faint' : 'text-ink'}`}
                            >
                              {label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {directorPrompt && (
                      <div className="mt-6 rounded-xl border border-white/5 bg-void-700/40 p-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold">
                          <span>✦</span> Claude’s direction
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{directorPrompt}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {phase === 'done' && videoUrl && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-1 flex-col"
                  >
                    <div className="overflow-hidden rounded-xl border border-gold/30 bg-void-700/40">
                      <video
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain"
                      />
                    </div>
                    <a
                      href={videoUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="btn-fire mt-4 w-full"
                    >
                      <Download className="h-4 w-4" />
                      Download video
                    </a>
                    {directorPrompt && (
                      <p className="mt-3 text-center text-[11px] text-ink-faint">
                        Directed by Claude · rendered by Google Veo 3
                      </p>
                    )}
                  </motion.div>
                )}

                {phase === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid flex-1 place-items-center text-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-fire-start">Generation failed</p>
                      <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">{error}</p>
                      <button
                        onClick={() => setPhase('idle')}
                        className="btn-ghost mt-5"
                        type="button"
                      >
                        Try again
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
