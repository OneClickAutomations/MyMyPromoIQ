/**
 * BrandVoiceSetup — the compact, one-time brand profile (Part 5).
 *
 * Not the full Brand Kit editor (/brand) — this is the 30-second version the
 * app prompts for on first use so every generation has a voice, creator vibe,
 * and CTA to calibrate against. Persists per user via the existing saveBrand /
 * getBrand endpoints. Non-gating: users can skip and Claude uses neutral
 * defaults. The creator defaults live in brand_guidelines as JSON so no schema
 * change is needed.
 */
import { useEffect, useState } from 'react'
import { useUser } from '../hooks/useAuth'
import { motion } from 'framer-motion'
import { Check, RefreshCw, X, Star } from './icons'
import { getBrand, saveBrand } from '../lib/api'

const CTA_OPTIONS = ['Visit link', 'DM us', 'Use my code', 'Shop now', 'Follow for more']
const ENERGY_OPTIONS = ['Calm', 'Engaging', 'Hype'] as const
const CREATOR_STYLES = ['Natural UGC', 'Professional Influencer', 'Luxury'] as const

export interface BrandProfile {
  brandVoice: string
  targetAudience: string
  cta: string
  creatorEnergy: string
  creatorStyle: string
}

const EMPTY: BrandProfile = { brandVoice: '', targetAudience: '', cta: '', creatorEnergy: 'Engaging', creatorStyle: 'Natural UGC' }

/** Read the saved compact brand profile (creator defaults live in guidelines JSON). */
export async function loadBrandProfile(userId: string): Promise<BrandProfile | null> {
  try {
    const { brand } = await getBrand(userId)
    if (!brand) return null
    let creator = { creatorEnergy: 'Engaging', creatorStyle: 'Natural UGC' }
    try { if (brand.brand_guidelines) creator = { ...creator, ...JSON.parse(brand.brand_guidelines) } } catch { /* plain text guidelines */ }
    return {
      brandVoice: brand.brand_voice ?? '',
      targetAudience: brand.target_audience ?? '',
      cta: brand.cta_preferences ?? '',
      creatorEnergy: creator.creatorEnergy,
      creatorStyle: creator.creatorStyle,
    }
  } catch { return null }
}

export default function BrandVoiceSetup({ onClose, onSaved }: { onClose: () => void; onSaved?: (p: BrandProfile) => void }) {
  const { user } = useUser()
  const [p, setP] = useState<BrandProfile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    loadBrandProfile(user.id).then(existing => { if (existing) setP(existing) }).finally(() => setLoading(false))
  }, [user?.id])

  const set = (u: Partial<BrandProfile>) => setP(prev => ({ ...prev, ...u }))

  async function save() {
    if (!user?.id) { onClose(); return }
    setSaving(true); setError('')
    try {
      await saveBrand(user.id, {
        brand_voice: p.brandVoice || null,
        target_audience: p.targetAudience || null,
        cta_preferences: p.cta || null,
        brand_guidelines: JSON.stringify({ creatorEnergy: p.creatorEnergy, creatorStyle: p.creatorStyle }),
      })
      onSaved?.(p)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-void-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-fire-start/15"><Star className="h-4 w-4 text-fire-start" /></div>
            <div>
              <p className="text-sm font-bold text-ink">Brand voice</p>
              <p className="text-[11px] text-ink-faint">Applies to every ad you generate. Takes 30 seconds.</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-white/[0.06] hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="grid place-items-center p-12"><RefreshCw className="h-5 w-5 animate-spin text-fire-start" /></div>
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Describe your brand in one sentence</label>
              <textarea value={p.brandVoice} onChange={e => set({ brandVoice: e.target.value })} rows={2}
                placeholder="e.g. Warm, science-backed skincare for busy people who want results without the fuss."
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-void-800 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none" />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Who's it for? (optional)</label>
              <input value={p.targetAudience} onChange={e => set({ targetAudience: e.target.value })}
                placeholder="e.g. Women 25–40 who care about clean ingredients"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-void-800 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/40 focus:outline-none" />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-ink-faint">Call to action</p>
              <div className="flex flex-wrap gap-1.5">
                {CTA_OPTIONS.map(c => (
                  <button key={c} onClick={() => set({ cta: c })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${p.cta === c ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30' : 'bg-void-800 text-ink-muted hover:text-ink'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-ink-faint">Creator energy</p>
              <div className="flex flex-wrap gap-1.5">
                {ENERGY_OPTIONS.map(c => (
                  <button key={c} onClick={() => set({ creatorEnergy: c })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${p.creatorEnergy === c ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30' : 'bg-void-800 text-ink-muted hover:text-ink'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-ink-faint">Creator style</p>
              <div className="flex flex-wrap gap-1.5">
                {CREATOR_STYLES.map(c => (
                  <button key={c} onClick={() => set({ creatorStyle: c })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${p.creatorStyle === c ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30' : 'bg-void-800 text-ink-muted hover:text-ink'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-amber-300">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] p-4">
          <button onClick={onClose} className="text-sm font-semibold text-ink-faint hover:text-ink">Skip for now</button>
          <button onClick={save} disabled={saving} className="btn-fire gap-1.5 px-5 py-2.5 text-sm disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save brand voice'}
          </button>
        </div>
      </motion.div>
    </>
  )
}
