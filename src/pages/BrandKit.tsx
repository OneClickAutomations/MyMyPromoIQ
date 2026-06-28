import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import { Palette, Check, Plus, X } from '../components/icons'
import { getBrand, saveBrand, type StoredBrand } from '../lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Beauty & Skincare', 'Health & Wellness', 'Food & Beverage', 'Fitness & Sports',
  'Fashion & Apparel', 'Technology', 'Home & Living', 'Baby & Kids',
  'Pet Care', 'Finance', 'Education', 'Travel', 'Real Estate', 'Other',
]

const BRAND_VOICES = [
  'Friendly & Approachable', 'Bold & Confident', 'Luxurious & Premium',
  'Educational & Informative', 'Playful & Fun', 'Professional & Authoritative',
  'Inspiring & Motivational', 'Casual & Conversational',
]

const DEFAULT_COLORS = [
  '#FF6B35', '#E8341C', '#F2B84B', '#6366f1',
  '#22c55e', '#ec4899', '#3b82f6', '#14b8a6',
]

// ── Color swatch picker ───────────────────────────────────────────────────────

function ColorPicker({
  colors,
  onChange,
  label,
}: {
  colors: string[]
  onChange: (colors: string[]) => void
  label: string
}) {
  const [inputVal, setInputVal] = useState('')

  function addColor() {
    const val = inputVal.trim()
    if (!val || colors.includes(val)) return
    onChange([...colors, val])
    setInputVal('')
  }

  function removeColor(c: string) {
    onChange(colors.filter(x => x !== c))
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-ink mb-2">{label}</label>

      {/* Preset swatches */}
      <div className="mb-3 flex flex-wrap gap-2">
        {DEFAULT_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => colors.includes(c) ? removeColor(c) : onChange([...colors, c])}
            className={`relative h-7 w-7 rounded-lg ring-2 transition-all ${colors.includes(c) ? 'ring-white' : 'ring-transparent'}`}
            style={{ background: c }}
            title={c}
          >
            {colors.includes(c) && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-white drop-shadow" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Selected colors */}
      {colors.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {colors.map(c => (
            <div key={c} className="flex items-center gap-1.5 rounded-lg border border-white/[0.10] bg-void-700/50 px-2 py-1">
              <div className="h-4 w-4 rounded-md flex-shrink-0" style={{ background: c }} />
              <span className="text-xs text-ink-muted font-mono">{c}</span>
              <button onClick={() => removeColor(c)} className="text-ink-faint hover:text-ink transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Custom color input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColor() } }}
          placeholder="#FF6B35 or rgb(255,107,53)"
          className="flex-1 rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
        />
        <button
          type="button"
          onClick={addColor}
          className="flex items-center gap-1 rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink hover:bg-void-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  )
}

// ── Taglines manager ──────────────────────────────────────────────────────────

function TaglineEditor({ taglines, onChange }: { taglines: string[]; onChange: (t: string[]) => void }) {
  const [inputVal, setInputVal] = useState('')

  function add() {
    const val = inputVal.trim()
    if (!val || taglines.includes(val)) return
    onChange([...taglines, val])
    setInputVal('')
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-ink mb-2">Taglines & Approved Phrases</label>
      <div className="mb-3 flex flex-wrap gap-2">
        {taglines.map(t => (
          <div key={t} className="flex items-center gap-1.5 rounded-xl border border-fire-start/20 bg-fire-start/5 px-3 py-1">
            <span className="text-xs font-semibold text-fire-start">{t}</span>
            <button onClick={() => onChange(taglines.filter(x => x !== t))} className="text-fire-start/50 hover:text-fire-start transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. Feel the difference · Trusted by thousands"
          className="flex-1 rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
        />
        <button type="button" onClick={add} className="flex items-center gap-1 rounded-xl border border-white/[0.10] bg-void-700/50 px-3 py-2 text-sm font-semibold text-ink-muted hover:text-ink hover:bg-void-700 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type BrandDraft = {
  name: string
  logo_url: string
  brand_voice: string
  industry: string
  target_audience: string
  brand_guidelines: string
  cta_preferences: string
  primary_colors: string[]
  secondary_colors: string[]
  taglines: string[]
}

function emptyDraft(): BrandDraft {
  return {
    name: '', logo_url: '', brand_voice: '', industry: '',
    target_audience: '', brand_guidelines: '', cta_preferences: '',
    primary_colors: [], secondary_colors: [], taglines: [],
  }
}

export default function BrandKit() {
  const { user } = useUser()
  const [draft, setDraft] = useState<BrandDraft>(emptyDraft)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getBrand(user.id)
      .then(r => {
        if (r.brand) {
          setBrandId(r.brand.id)
          setDraft({
            name: r.brand.name ?? '',
            logo_url: r.brand.logo_url ?? '',
            brand_voice: r.brand.brand_voice ?? '',
            industry: r.brand.industry ?? '',
            target_audience: r.brand.target_audience ?? '',
            brand_guidelines: r.brand.brand_guidelines ?? '',
            cta_preferences: r.brand.cta_preferences ?? '',
            primary_colors: r.brand.primary_colors ?? [],
            secondary_colors: r.brand.secondary_colors ?? [],
            taglines: r.brand.taglines ?? [],
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  const set = useCallback(<K extends keyof BrandDraft>(key: K, val: BrandDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }, [])

  async function handleSave() {
    if (!user?.id || !draft.name.trim()) return
    setSaving(true)
    try {
      const result = await saveBrand(user.id, {
        ...(brandId ? { id: brandId } : {}),
        name: draft.name,
        logo_url: draft.logo_url || null,
        brand_voice: draft.brand_voice || null,
        industry: draft.industry || null,
        target_audience: draft.target_audience || null,
        brand_guidelines: draft.brand_guidelines || null,
        cta_preferences: draft.cta_preferences || null,
        primary_colors: draft.primary_colors,
        secondary_colors: draft.secondary_colors,
        taglines: draft.taglines,
      } as Partial<StoredBrand>)
      setBrandId(result.id)
      setSaved(true)
    } catch {}
    setSaving(false)
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-void-600 border-t-fire-start" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Creative Studio</p>
          <h1 className="text-3xl font-black tracking-tight text-ink md:text-4xl">
            Brand Kit
            <span className="ml-2 inline-block text-fire-start">·</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Define your brand once. Every campaign inherits these settings automatically.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!draft.name.trim() || saving}
          className="btn-fire mt-4 flex-shrink-0 gap-2 self-start sm:mt-0 disabled:opacity-50"
        >
          {saving
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</>
            : saved
            ? <><Check className="h-4 w-4" /> Saved</>
            : <><Palette className="h-4 w-4" /> Save Brand Kit</>
          }
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="mt-7 grid gap-6 lg:grid-cols-2"
      >
        {/* Left column */}
        <div className="space-y-6">
          {/* Brand Name */}
          <div className="rounded-2xl border border-white/[0.08] bg-void-800/50 p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-faint">Identity</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Brand Name <span className="text-fire-start">*</span></label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Nova Labs"
                  className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Logo URL</label>
                <input
                  type="url"
                  value={draft.logo_url}
                  onChange={e => set('logo_url', e.target.value)}
                  placeholder="https://yourbrand.com/logo.png"
                  className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
                />
                {draft.logo_url && (
                  <div className="mt-2 h-16 w-32 rounded-xl border border-white/[0.08] bg-void-700/40 overflow-hidden flex items-center justify-center p-2">
                    <img src={draft.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Industry</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map(ind => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => set('industry', draft.industry === ind ? '' : ind)}
                      className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all ${
                        draft.industry === ind
                          ? 'border-fire-start/60 bg-fire-start/10 text-fire-start ring-1 ring-fire-start/30'
                          : 'border-white/[0.08] bg-void-700/40 text-ink-muted hover:border-white/20 hover:text-ink'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Target Audience</label>
                <input
                  type="text"
                  value={draft.target_audience}
                  onChange={e => set('target_audience', e.target.value)}
                  placeholder="e.g. Women 25-40 interested in clean beauty"
                  className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="rounded-2xl border border-white/[0.08] bg-void-800/50 p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-faint">Colors</h3>
            <div className="space-y-5">
              <ColorPicker label="Primary Colors" colors={draft.primary_colors} onChange={c => set('primary_colors', c)} />
              <ColorPicker label="Secondary Colors" colors={draft.secondary_colors} onChange={c => set('secondary_colors', c)} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Voice */}
          <div className="rounded-2xl border border-white/[0.08] bg-void-800/50 p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-faint">Brand Voice</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Voice & Tone</label>
                <div className="flex flex-wrap gap-2">
                  {BRAND_VOICES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('brand_voice', draft.brand_voice === v ? '' : v)}
                      className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all ${
                        draft.brand_voice === v
                          ? 'border-fire-start/60 bg-fire-start/10 text-fire-start ring-1 ring-fire-start/30'
                          : 'border-white/[0.08] bg-void-700/40 text-ink-muted hover:border-white/20 hover:text-ink'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <TaglineEditor taglines={draft.taglines} onChange={t => set('taglines', t)} />

              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Preferred CTA Style</label>
                <input
                  type="text"
                  value={draft.cta_preferences}
                  onChange={e => set('cta_preferences', e.target.value)}
                  placeholder="e.g. Shop now · Try free · Get yours today"
                  className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="rounded-2xl border border-white/[0.08] bg-void-800/50 p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-faint">Brand Guidelines</h3>
            <textarea
              rows={6}
              value={draft.brand_guidelines}
              onChange={e => set('brand_guidelines', e.target.value)}
              placeholder="Paste your brand guidelines, dos & don'ts, tone of voice notes, or any instructions the AI Creative Director should follow for every campaign."
              className="w-full resize-none rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>
        </div>
      </motion.div>

      {/* Sticky save bar on mobile */}
      <div className="sticky bottom-4 mt-6 flex justify-end lg:hidden">
        <button
          onClick={handleSave}
          disabled={!draft.name.trim() || saving}
          className="btn-fire gap-2 shadow-fire-soft disabled:opacity-50"
        >
          {saving
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</>
            : saved
            ? <><Check className="h-4 w-4" /> Saved</>
            : <><Palette className="h-4 w-4" /> Save Brand Kit</>
          }
        </button>
      </div>
    </AppShell>
  )
}
