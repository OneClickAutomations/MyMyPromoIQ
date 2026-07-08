import { useState, useEffect } from 'react'
import { useUser } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '../components/AppShell'
import { Plus, Edit, Trash, X, Users, Check, Wand } from '../components/icons'
import { listCreators, saveCreator, deleteCreator, type StoredCreator } from '../lib/api'
import SeedImageStudio, { type SeedImage } from '../components/SeedImageStudio'

// ── Option catalogs ───────────────────────────────────────────────────────────

const CREATOR_TYPES = [
  'Lifestyle Influencer', 'Fitness Coach', 'Beauty Creator', 'Tech Reviewer',
  'Luxury Brand Ambassador', 'Mom Creator', 'Dad Creator', 'Outdoor Creator',
  'Chef', 'Doctor / Healthcare', 'Business Professional', 'General Creator',
]
const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary']
const AGE_OPTIONS = ['18–24', '25–34', '35–44', '45–54', '55+']
const ETHNICITY_OPTIONS = [
  'Asian', 'Black / African American', 'Hispanic / Latino',
  'Middle Eastern', 'South Asian', 'White / Caucasian', 'Mixed / Other',
]
const SKIN_TONE_OPTIONS = ['Fair', 'Light', 'Medium', 'Olive', 'Tan', 'Brown', 'Dark']
const ENERGY_OPTIONS = [
  { id: 'low',    label: 'Calm',     hint: 'Trustworthy, measured delivery' },
  { id: 'medium', label: 'Engaging', hint: 'Relatable, natural enthusiasm' },
  { id: 'high',   label: 'Hype',     hint: 'High-energy, scroll-stopper' },
]
const SPEAKING_STYLES = ['Conversational', 'Professional', 'Energetic', 'Calm', 'Authoritative', 'Playful']
const CAMERA_CONFIDENCE_OPTIONS = ['Natural / Casual', 'Confident Influencer', 'Professional Presenter', 'Expert Authority']
const WARDROBE_OPTIONS = ['Casual Streetwear', 'Athletic / Sportswear', 'Business Casual', 'Cozy Loungewear', 'Trendy Fashion', 'Classic / Timeless', 'Luxury / High-Fashion']

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'
}

const AVATAR_COLORS = [
  '#FF6B35', '#E8341C', '#F2B84B', '#6366f1', '#22c55e', '#ec4899', '#3b82f6', '#a855f7',
]
function getAvatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Chip selector ─────────────────────────────────────────────────────────────

function Chips({
  options, value, onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? '' : opt)}
          className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all ${
            value === opt
              ? 'border-fire-start/60 bg-fire-start/10 text-fire-start ring-1 ring-fire-start/30'
              : 'border-white/[0.08] bg-void-700/40 text-ink-muted hover:border-white/20 hover:text-ink'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── Creator card ──────────────────────────────────────────────────────────────

function CreatorCard({
  creator, onEdit, onDelete, deleting,
}: {
  creator: StoredCreator
  onEdit: (c: StoredCreator) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const attrs = creator.attributes as Record<string, string>
  const initials = getInitials(creator.name)
  const avatarBg = getAvatarColor(creator.name)
  const seedFace = creator.seed_images?.[0]?.url

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800/60 p-5 transition-all hover:border-white/[0.14] hover:bg-void-800/80"
    >
      {/* Avatar + name */}
      <div className="mb-4 flex items-center gap-3">
        {seedFace ? (
          <img src={seedFace} alt={creator.name} className="h-12 w-12 flex-shrink-0 rounded-xl object-cover shadow-lg ring-1 ring-white/10" />
        ) : (
          <div
            className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl text-white text-lg font-black shadow-lg"
            style={{ background: avatarBg }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{creator.name}</p>
          <p className="text-xs text-ink-muted">{attrs?.creatorType || 'AI Creator'}</p>
        </div>
      </div>

      {/* Attribute chips */}
      <div className="flex flex-wrap gap-1.5">
        {attrs?.gender && (
          <span className="rounded-full bg-void-700/60 px-2 py-0.5 text-[10px] font-semibold text-ink-muted">{attrs.gender}</span>
        )}
        {attrs?.ageRange && (
          <span className="rounded-full bg-void-700/60 px-2 py-0.5 text-[10px] font-semibold text-ink-muted">{attrs.ageRange}</span>
        )}
        {attrs?.energyLevel && (
          <span className="rounded-full bg-fire-start/10 px-2 py-0.5 text-[10px] font-semibold text-fire-start">
            {attrs.energyLevel === 'low' ? 'Calm' : attrs.energyLevel === 'medium' ? 'Engaging' : 'Hype'}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          onClick={() => onEdit(creator)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-void-700/50 py-2 text-xs font-semibold text-ink-muted hover:bg-void-700 hover:text-ink transition-colors"
        >
          <Edit className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          onClick={() => onDelete(creator.id)}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-fire-start/20 bg-fire-start/5 py-2 text-xs font-semibold text-fire-start hover:bg-fire-start/10 transition-colors disabled:opacity-50"
        >
          {deleting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-fire-start/30 border-t-fire-start" /> : <Trash className="h-3.5 w-3.5" />}
          Delete
        </button>
      </div>
    </motion.div>
  )
}

// ── Creator panel (slide-over) ────────────────────────────────────────────────

type CreatorDraft = {
  name: string
  creatorType: string
  gender: string
  ageRange: string
  ethnicity: string
  skinTone: string
  wardrobe: string
  energyLevel: string
  speakingStyle: string
  cameraConfidence: string
  personality: string
  notes: string
}

function emptyDraft(): CreatorDraft {
  return {
    name: '', creatorType: '', gender: '', ageRange: '', ethnicity: '',
    skinTone: '', wardrobe: '', energyLevel: '', speakingStyle: '',
    cameraConfidence: '', personality: '', notes: '',
  }
}

function CreatorPanel({
  initial,
  onSave,
  onClose,
}: {
  initial: StoredCreator | null
  onSave: (draft: CreatorDraft, seedImages: SeedImage[], id?: string) => Promise<void>
  onClose: () => void
}) {
  const attrs = initial?.attributes as Record<string, string> | undefined
  const [seedImages, setSeedImages] = useState<SeedImage[]>(initial?.seed_images ?? [])
  const [draft, setDraft] = useState<CreatorDraft>(() =>
    initial ? {
      name: initial.name,
      creatorType: attrs?.creatorType ?? '',
      gender: attrs?.gender ?? '',
      ageRange: attrs?.ageRange ?? '',
      ethnicity: attrs?.ethnicity ?? '',
      skinTone: attrs?.skinTone ?? '',
      wardrobe: attrs?.wardrobe ?? '',
      energyLevel: attrs?.energyLevel ?? '',
      speakingStyle: attrs?.speakingStyle ?? '',
      cameraConfidence: attrs?.cameraConfidence ?? '',
      personality: attrs?.personality ?? '',
      notes: attrs?.notes ?? '',
    } : emptyDraft()
  )
  const [saving, setSaving] = useState(false)

  function set(key: keyof CreatorDraft, val: string) {
    setDraft(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      await onSave(draft, seedImages, initial?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-60 flex w-full max-w-lg flex-col border-l border-white/[0.08] bg-void-900 shadow-2xl"
        style={{ zIndex: 60 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">{initial ? 'Edit Creator' : 'New Creator'}</h2>
              <p className="text-xs text-ink-faint">Saved to your Creator Library</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-faint hover:bg-white/[0.06] hover:text-ink transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Display Name <span className="text-fire-start">*</span></label>
            <input
              type="text"
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Emma Chen"
              className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>

          {/* Appearance — seed images (upload or generate) */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Appearance</label>
            <p className="mb-3 text-xs text-ink-faint">Upload a reference photo or generate what this creator looks like. The primary seed image becomes the reference for every video.</p>
            <SeedImageStudio
              subjectType="character"
              subjectHint={[draft.name, draft.creatorType, draft.gender, draft.ageRange, draft.ethnicity].filter(Boolean).join(', ') || undefined}
              images={seedImages}
              onChange={setSeedImages}
            />
          </div>

          {/* Creator Type */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Creator Type</label>
            <Chips options={CREATOR_TYPES} value={draft.creatorType} onChange={v => set('creatorType', v)} />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Gender</label>
            <Chips options={GENDER_OPTIONS} value={draft.gender} onChange={v => set('gender', v)} />
          </div>

          {/* Age Range */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Age Range</label>
            <Chips options={AGE_OPTIONS} value={draft.ageRange} onChange={v => set('ageRange', v)} />
          </div>

          {/* Ethnicity */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Ethnicity</label>
            <Chips options={ETHNICITY_OPTIONS} value={draft.ethnicity} onChange={v => set('ethnicity', v)} />
          </div>

          {/* Skin Tone */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Skin Tone</label>
            <Chips options={SKIN_TONE_OPTIONS} value={draft.skinTone} onChange={v => set('skinTone', v)} />
          </div>

          {/* Wardrobe */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Wardrobe Style</label>
            <Chips options={WARDROBE_OPTIONS} value={draft.wardrobe} onChange={v => set('wardrobe', v)} />
          </div>

          {/* Energy Level */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Energy Level</label>
            <div className="space-y-2">
              {ENERGY_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set('energyLevel', draft.energyLevel === opt.id ? '' : opt.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    draft.energyLevel === opt.id
                      ? 'border-fire-start/60 bg-fire-start/[0.08] ring-1 ring-fire-start/30'
                      : 'border-white/[0.08] bg-void-800/50 hover:border-white/20'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    opt.id === 'low' ? 'bg-blue-400' : opt.id === 'medium' ? 'bg-gold' : 'bg-fire-start'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{opt.label}</p>
                    <p className="text-xs text-ink-faint">{opt.hint}</p>
                  </div>
                  {draft.energyLevel === opt.id && <Check className="h-4 w-4 text-fire-start flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Speaking Style */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Speaking Style</label>
            <Chips options={SPEAKING_STYLES} value={draft.speakingStyle} onChange={v => set('speakingStyle', v)} />
          </div>

          {/* Camera Confidence */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Camera Confidence</label>
            <Chips options={CAMERA_CONFIDENCE_OPTIONS} value={draft.cameraConfidence} onChange={v => set('cameraConfidence', v)} />
          </div>

          {/* Personality */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Personality</label>
            <input
              type="text"
              value={draft.personality}
              onChange={e => set('personality', e.target.value)}
              placeholder="e.g. warm, relatable, authentically excited"
              className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Director Notes</label>
            <textarea
              rows={3}
              value={draft.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any special instructions for the AI director — props, setting, mood, etc."
              className="w-full resize-none rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-white/[0.06] px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/[0.10] bg-void-700/50 py-3 text-sm font-semibold text-ink-muted hover:text-ink hover:bg-void-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!draft.name.trim() || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-fire py-3 text-sm font-bold text-white shadow-fire-soft disabled:opacity-50 transition-opacity"
          >
            {saving
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</>
              : <><Wand className="h-4 w-4" /> Save Creator</>
            }
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-10 overflow-hidden rounded-[28px] border border-white/[0.08] bg-void-800/30">
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,107,53,0.4) 50%, transparent 100%)' }} />
      <div className="px-6 py-14 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-fire shadow-fire-soft mx-auto mb-5">
          <Users className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-ink">Build your talent roster</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted leading-relaxed">
          Create persistent AI creators that star in every campaign — same face, wardrobe, and energy every time.
        </p>
        <button onClick={onNew} className="btn-fire mx-auto mt-7 gap-2 inline-flex">
          <Plus className="h-4 w-4" /> Create First Creator
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreatorStudio() {
  const { user } = useUser()
  const [creators, setCreators] = useState<StoredCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<StoredCreator | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function refresh() {
    if (!user?.id) return
    setLoading(true)
    listCreators(user.id)
      .then(r => setCreators(r.creators))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() { setEditing(null); setPanelOpen(true) }
  function openEdit(c: StoredCreator) { setEditing(c); setPanelOpen(true) }

  async function handleDelete(id: string) {
    if (!user?.id) return
    setDeleting(id)
    try {
      await deleteCreator(user.id, id)
      setCreators(prev => prev.filter(c => c.id !== id))
    } catch {}
    setDeleting(null)
  }

  async function handleSave(draft: CreatorDraft, seedImages: SeedImage[], id?: string) {
    if (!user?.id) return
    await saveCreator(user.id, {
      ...(id ? { id } : {}),
      name: draft.name,
      mode: seedImages.length ? 'uploaded_seed' : 'generated',
      seed_images: seedImages,
      attributes: {
        creatorType: draft.creatorType,
        gender: draft.gender,
        ageRange: draft.ageRange,
        ethnicity: draft.ethnicity,
        skinTone: draft.skinTone,
        wardrobe: draft.wardrobe,
        energyLevel: draft.energyLevel,
        speakingStyle: draft.speakingStyle,
        cameraConfidence: draft.cameraConfidence,
        personality: draft.personality,
        notes: draft.notes,
      },
    })
    setPanelOpen(false)
    refresh()
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
            AI Creator Studio
            <span className="ml-2 inline-block text-fire-start">·</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Build persistent creators that star in every campaign — consistent identity, every time.</p>
        </div>
        <button onClick={openNew} className="btn-fire mt-4 flex-shrink-0 gap-2 self-start sm:mt-0">
          <Plus className="h-4 w-4" /> New Creator
        </button>
      </motion.div>

      {/* Stats bar */}
      {!loading && creators.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-5 flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-void-800/40 px-5 py-3"
        >
          <div>
            <p className="text-2xl font-extrabold text-fire-start">{creators.length}</p>
            <p className="text-xs text-ink-faint">Creator{creators.length !== 1 ? 's' : ''} in library</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <p className="text-sm text-ink-muted">Each creator can appear in unlimited campaigns with full identity consistency.</p>
        </motion.div>
      )}

      {/* Grid */}
      <div className="mt-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-void-800/50" />
            ))}
          </div>
        ) : creators.length === 0 ? (
          <EmptyState onNew={openNew} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {creators.map(c => (
                <CreatorCard
                  key={c.id}
                  creator={c}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deleting={deleting === c.id}
                />
              ))}
            </AnimatePresence>
            {/* Add new card */}
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={openNew}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-void-600 bg-void-800/20 px-6 py-10 text-center transition-all hover:border-fire-start/40 hover:bg-void-800/40"
            >
              <Plus className="h-6 w-6 text-ink-faint" />
              <span className="text-sm font-semibold text-ink-faint">New Creator</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Panel */}
      <AnimatePresence>
        {panelOpen && (
          <CreatorPanel initial={editing} onSave={handleSave} onClose={() => setPanelOpen(false)} />
        )}
      </AnimatePresence>
    </AppShell>
  )
}
