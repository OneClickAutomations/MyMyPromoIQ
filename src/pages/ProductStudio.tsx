import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '../components/AppShell'
import { Plus, Edit, Trash, X, Package } from '../components/icons'
import { listProducts, saveProduct, deleteProduct, type StoredProduct } from '../lib/api'
import SeedImageStudio, { type SeedImage } from '../components/SeedImageStudio'

// ── Option catalogs ───────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = [
  'Skincare', 'Haircare', 'Makeup / Beauty', 'Supplements / Health',
  'Food & Beverage', 'Fitness / Sports', 'Fashion / Apparel',
  'Tech / Electronics', 'Home & Living', 'Pet Products',
  'Baby & Kids', 'Books & Courses', 'Software / SaaS', 'Other',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
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

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({
  product, onEdit, onDelete, deleting,
}: {
  product: StoredProduct
  onEdit: (p: StoredProduct) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800/60 transition-all hover:border-white/[0.14] hover:bg-void-800/80"
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-void-700/40">
        {product.primary_image_url && !imgError ? (
          <img
            src={product.primary_image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-10 w-10 text-ink-faint/30" />
          </div>
        )}
        {/* Category badge */}
        {product.category && (
          <span className="absolute right-2 top-2 rounded-lg bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm ring-1 ring-white/10">
            {product.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="font-bold text-ink truncate">{product.name}</p>
        {product.brand && <p className="mt-0.5 text-xs text-ink-muted">{product.brand}</p>}
        {product.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-faint">{product.description}</p>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            onClick={() => onEdit(product)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-void-700/50 py-2 text-xs font-semibold text-ink-muted hover:bg-void-700 hover:text-ink transition-colors"
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => onDelete(product.id)}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-fire-start/20 bg-fire-start/5 py-2 text-xs font-semibold text-fire-start hover:bg-fire-start/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-fire-start/30 border-t-fire-start" /> : <Trash className="h-3.5 w-3.5" />}
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Product panel (slide-over) ────────────────────────────────────────────────

type ProductDraft = {
  name: string
  brand: string
  category: string
  primary_image_url: string
  description: string
  target_audience: string
  featuresText: string
  benefitsText: string
}

function emptyDraft(): ProductDraft {
  return { name: '', brand: '', category: '', primary_image_url: '', description: '', target_audience: '', featuresText: '', benefitsText: '' }
}

function ProductPanel({
  initial,
  onSave,
  onClose,
}: {
  initial: StoredProduct | null
  onSave: (draft: ProductDraft, images: SeedImage[], id?: string) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ProductDraft>(() =>
    initial ? {
      name: initial.name,
      brand: initial.brand ?? '',
      category: initial.category ?? '',
      primary_image_url: initial.primary_image_url ?? '',
      description: initial.description ?? '',
      target_audience: initial.target_audience ?? '',
      featuresText: (initial.features ?? []).join('\n'),
      benefitsText: (initial.benefits ?? []).join('\n'),
    } : emptyDraft()
  )
  // Seed with existing images (and the primary image, if it isn't already in the list).
  const [images, setImages] = useState<SeedImage[]>(() => {
    const list = initial?.images ?? []
    const primary = initial?.primary_image_url
    if (primary && !list.some(i => i.url === primary)) return [{ url: primary, label: 'Primary' }, ...list]
    return list
  })
  const [saving, setSaving] = useState(false)

  function set(key: keyof ProductDraft, val: string) {
    setDraft(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit() {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      await onSave(draft, images, initial?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-white/[0.08] bg-void-900 shadow-2xl"
        style={{ zIndex: 60 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-fire shadow-fire-soft">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">{initial ? 'Edit Product' : 'New Product'}</h2>
              <p className="text-xs text-ink-faint">Saved to your Product Library</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-faint hover:bg-white/[0.06] hover:text-ink transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Product Name */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Product Name <span className="text-fire-start">*</span></label>
            <input
              type="text"
              value={draft.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. NovaCream Daily SPF 50"
              className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Brand</label>
            <input
              type="text"
              value={draft.brand}
              onChange={e => set('brand', e.target.value)}
              placeholder="e.g. Nova Labs"
              className="w-full rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Category</label>
            <Chips options={PRODUCT_CATEGORIES} value={draft.category} onChange={v => set('category', v)} />
          </div>

          {/* Product Images — upload, generate, or edit */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Product Images</label>
            <p className="mb-3 text-xs text-ink-faint">Upload a product photo or generate one. Restage it, swap the background, or recolor it — the primary image becomes the reference for every video.</p>
            <SeedImageStudio
              subjectType="product"
              subjectHint={[draft.name, draft.brand, draft.category].filter(Boolean).join(', ') || undefined}
              images={images}
              onChange={setImages}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Product Description</label>
            <textarea
              rows={3}
              value={draft.description}
              onChange={e => set('description', e.target.value)}
              placeholder="A matte ceramic pour-over coffee dripper for slow mornings."
              className="w-full resize-none rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>

          {/* Target Audience */}
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

          {/* Features */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Key Features</label>
            <p className="mb-2 text-xs text-ink-faint">One per line</p>
            <textarea
              rows={3}
              value={draft.featuresText}
              onChange={e => set('featuresText', e.target.value)}
              placeholder={"SPF 50 broad spectrum\nLightweight, non-greasy formula\nVegan & cruelty-free"}
              className="w-full resize-none rounded-xl border border-white/[0.10] bg-void-700/50 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-fire-start/50 focus:outline-none focus:ring-2 focus:ring-fire-start/20 transition-colors"
            />
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Key Benefits</label>
            <p className="mb-2 text-xs text-ink-faint">One per line</p>
            <textarea
              rows={3}
              value={draft.benefitsText}
              onChange={e => set('benefitsText', e.target.value)}
              placeholder={"Protects from UV damage\nNo white cast on any skin tone\nWears under makeup"}
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
              : <><Package className="h-4 w-4" /> Save Product</>
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
          <Package className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-ink">Save products once, use forever</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted leading-relaxed">
          Upload your product images and details once. Reuse them across unlimited campaigns without re-uploading.
        </p>
        <button onClick={onNew} className="btn-fire mx-auto mt-7 gap-2 inline-flex">
          <Plus className="h-4 w-4" /> Add First Product
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductStudio() {
  const { user } = useUser()
  const [products, setProducts] = useState<StoredProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState<StoredProduct | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function refresh() {
    if (!user?.id) return
    setLoading(true)
    listProducts(user.id)
      .then(r => setProducts(r.products))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() { setEditing(null); setPanelOpen(true) }
  function openEdit(p: StoredProduct) { setEditing(p); setPanelOpen(true) }

  async function handleDelete(id: string) {
    if (!user?.id) return
    setDeleting(id)
    try {
      await deleteProduct(user.id, id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch {}
    setDeleting(null)
  }

  async function handleSave(draft: ProductDraft, images: SeedImage[], id?: string) {
    if (!user?.id) return
    await saveProduct(user.id, {
      ...(id ? { id } : {}),
      name: draft.name,
      brand: draft.brand || null,
      category: draft.category || null,
      // The first seed image is the primary product shot used as the video reference.
      primary_image_url: images[0]?.url || draft.primary_image_url || null,
      images,
      description: draft.description || null,
      target_audience: draft.target_audience || null,
      features: draft.featuresText.split('\n').map(l => l.trim()).filter(Boolean),
      benefits: draft.benefitsText.split('\n').map(l => l.trim()).filter(Boolean),
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
            Product Studio
            <span className="ml-2 inline-block text-fire-start">·</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Upload once, use across every campaign. Your product library stays consistent.</p>
        </div>
        <button onClick={openNew} className="btn-fire mt-4 flex-shrink-0 gap-2 self-start sm:mt-0">
          <Plus className="h-4 w-4" /> New Product
        </button>
      </motion.div>

      {/* Grid */}
      <div className="mt-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-void-800/50" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState onNew={openNew} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {products.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deleting={deleting === p.id}
                />
              ))}
            </AnimatePresence>
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={openNew}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-void-600 bg-void-800/20 px-6 py-10 text-center transition-all hover:border-fire-start/40 hover:bg-void-800/40"
            >
              <Plus className="h-6 w-6 text-ink-faint" />
              <span className="text-sm font-semibold text-ink-faint">New Product</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Panel */}
      <AnimatePresence>
        {panelOpen && (
          <ProductPanel initial={editing} onSave={handleSave} onClose={() => setPanelOpen(false)} />
        )}
      </AnimatePresence>
    </AppShell>
  )
}
