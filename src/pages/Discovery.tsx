/**
 * Discovery Engine & Clone Bridge.
 *
 * Sits in front of the Commercial Studio wizard. Research a winning ad → score
 * it → let Claude analyze it → clone into a pre-filled CreativeBrief the wizard
 * opens, fully editable. The user never sees Apify, Meta's API, or a raw scrape.
 *
 * Two entry workflows, one destination:
 *   A — has a product: browse scored ads → clone → upload own product in wizard
 *   B — find a product: keyword/URL search → same scored list → same clone flow
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AppShell from '../components/AppShell'
import {
  Compass, Search, TrendingUp, Wand, X, Check, ArrowRight, Spark,
  Package, Clock, Bolt, RefreshCw, LinkIcon,
} from '../components/icons'
import { runDiscoverySearch, analyzeSourceAd, runSourcingLookup, type SourcingResponse } from '../lib/discovery/api'
import type {
  SourceAd, AdPlatform, ScoreRating, AdAnalysis, ClonePrefill, AdSearchResponse, SourcingResult,
} from '../lib/discovery/types'

type Workflow = 'has_product' | 'find_product'
type PlatformFilter = AdPlatform | 'both'
type SortKey = 'score' | 'days' | 'newest'

const CLONE_PREFILL_KEY = 'promoiq_clone_prefill'

// ── Score visual language — small semantic badges, never full-card fills ──────
const RATING_STYLES: Record<ScoreRating, { dot: string; text: string; ring: string; label: string }> = {
  green:  { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/30 bg-emerald-400/10', label: 'Strong' },
  yellow: { dot: 'bg-amber-400',   text: 'text-amber-300',   ring: 'ring-amber-400/30 bg-amber-400/10',     label: 'Mixed' },
  red:    { dot: 'bg-rose-400',    text: 'text-rose-300',     ring: 'ring-rose-400/30 bg-rose-400/10',       label: 'Weak' },
}

function ScoreBadge({ rating, total }: { rating: ScoreRating; total: number }) {
  const s = RATING_STYLES[rating]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${s.ring} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {total}
    </span>
  )
}

// ── Entry choice ──────────────────────────────────────────────────────────────
function EntryChoice({ onPick }: { onPick: (w: Workflow) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Discover winning ads</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Research real running ads, see why they work, and clone the winning structure onto your product.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          { w: 'has_product' as const, icon: Package, title: 'I have a product', desc: 'Browse scored ads in your niche, then apply a winning concept to your own product.' },
          { w: 'find_product' as const, icon: TrendingUp, title: 'Find me a winning product', desc: 'Search by keyword or paste a product URL to reverse-search ad libraries.' },
        ]).map(({ w, icon: Icon, title, desc }) => (
          <button
            key={w}
            type="button"
            onClick={() => onPick(w)}
            className="group rounded-2xl border border-white/[0.08] bg-void-800 p-6 text-left transition-all hover:border-fire-start/40 hover:bg-fire-start/[0.04]"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-void-700 transition-colors group-hover:bg-fire-start/15">
              <Icon className="h-6 w-6 text-fire-start" />
            </div>
            <p className="mt-4 text-lg font-bold text-ink">{title}</p>
            <p className="mt-1.5 text-sm text-ink-muted">{desc}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fire-start">
              Start <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">
        Estimated from public signals — not a guarantee of performance.
      </p>
    </div>
  )
}

// ── Searching log feed (mirrors the AI Director feed pattern) ─────────────────
const SEARCH_STAGES = ['Querying ad libraries', 'Pulling active creatives', 'Scoring opportunities', 'Ranking results']
const ANALYZE_STAGES = ['Analyzing hook', 'Mapping structure', 'Drafting differentiated script', 'Matching creator']

function LogFeed({ title, stages, doneCount }: { title: string; stages: string[]; doneCount: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-void-900/60 p-6">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fire-start/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fire-start" />
        </span>
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <ul className="mt-4 space-y-2.5">
        {stages.map((s, i) => {
          const done = i < doneCount
          const active = i === doneCount
          return (
            <li key={s} className={`flex items-center gap-2.5 text-sm transition-colors ${done ? 'text-ink' : active ? 'text-ink-muted' : 'text-ink-faint/50'}`}>
              {done
                ? <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                : <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${active ? 'bg-fire-start animate-pulse' : 'bg-ink-faint/30'}`} />}
              {s}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Factor breakdown bar ──────────────────────────────────────────────────────
function FactorRow({ label, value, signal }: { label: string; value: number; signal: string }) {
  const color = value >= 70 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-ink">{label}</span>
        <span className="text-[11px] text-ink-faint">{signal}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void-600/60">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  )
}

// ── Result card ───────────────────────────────────────────────────────────────
function AdCard({ ad, onOpen }: { ad: SourceAd; onOpen: () => void }) {
  const media = ad.creative.mediaUrls[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800 text-left transition-all hover:border-white/20"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-void-700">
        {media
          ? <img src={media} alt={ad.product.name ?? ad.pageOrShopName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          : <div className="grid h-full place-items-center"><Package className="h-8 w-8 text-ink-faint" /></div>}
        <div className="absolute left-2 top-2"><ScoreBadge rating={ad.score.rating} total={ad.score.total} /></div>
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {ad.platform}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="truncate text-sm font-bold text-ink">{ad.product.name ?? ad.creative.headline ?? ad.pageOrShopName}</p>
        <p className="truncate text-xs text-ink-muted">{ad.pageOrShopName}</p>
        {ad.creative.bodyText && (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-ink-faint">{ad.creative.bodyText}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {ad.delivery.daysRunning}d running</span>
          {ad.delivery.impressionsRange && <span>· {ad.delivery.impressionsRange} impressions</span>}
          {ad.creative.mediaType === 'video' && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase">Video</span>}
        </div>
      </div>
    </button>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
// ── Sourcing panel — live AliExpress lookup + CJ fulfillment handoff ──────────
function ConfidenceBadge({ confidence }: { confidence: SourcingResult['confidence'] }) {
  const styles: Record<SourcingResult['confidence'], string> = {
    high:   'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
    medium: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
    low:    'bg-rose-400/15 text-rose-300 ring-rose-400/30',
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${styles[confidence]}`}>
      {confidence} confidence
    </span>
  )
}

function SourcingPanel({ ad }: { ad: SourceAd }) {
  // Seed from any match already attached to the ad; otherwise run a live lookup.
  const seeded = ad.product.matchedSourcingResult ?? null
  const [result, setResult] = useState<SourcingResult | null>(seeded)
  const [fulfillUrl, setFulfillUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [looked, setLooked] = useState(!!seeded)

  const adProductShot = ad.creative.mediaUrls[0]

  async function lookup() {
    if (!ad.product.name) { setError('No product name on this ad to search with.'); return }
    setLoading(true); setError(''); setNotice('')
    try {
      const r: SourcingResponse = await runSourcingLookup(ad.product.name, ad.creative.mediaUrls[0])
      setResult(r.sourcingResult)
      setFulfillUrl(r.fulfillUrl)
      if (r.notice) setNotice(r.notice)
      setLooked(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sourcing lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-run a lookup the first time the drawer opens with no seeded match.
  useEffect(() => { if (!seeded && ad.product.name) lookup() /* eslint-disable-next-line */ }, [])

  const cjUrl = fulfillUrl ?? `https://cjdropshipping.com/list/search?searchText=${encodeURIComponent(ad.product.name ?? '')}`

  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-800/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Sourcing match</p>
        {looked && (
          <button onClick={lookup} disabled={loading} className="inline-flex items-center gap-1 text-[11px] font-semibold text-fire-start hover:text-fire-end disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Re-check
          </button>
        )}
      </div>

      {loading && !result && (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          <RefreshCw className="h-4 w-4 animate-spin text-fire-start" /> Searching marketplaces…
        </div>
      )}

      {/* Matched result — side-by-side: ad product shot vs marketplace match */}
      {result && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Ad product</p>
              {adProductShot
                ? <img src={adProductShot} alt="" className="aspect-square w-full rounded-lg object-cover ring-1 ring-white/10" />
                : <div className="grid aspect-square w-full place-items-center rounded-lg bg-void-700 text-ink-faint"><Package className="h-6 w-6" /></div>}
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Marketplace match</p>
              {result.matchedImageUrl
                ? <img src={result.matchedImageUrl} alt="" className="aspect-square w-full rounded-lg object-cover ring-1 ring-white/10" />
                : <div className="grid aspect-square w-full place-items-center rounded-lg bg-void-700 text-ink-faint"><Package className="h-6 w-6" /></div>}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-base font-bold text-ink">
              {result.currency === 'USD' ? '$' : ''}{result.unitCost.toFixed(2)}
              <span className="ml-1 text-xs font-normal text-ink-muted">{result.currency !== 'USD' ? result.currency : ''} / unit</span>
            </p>
            <ConfidenceBadge confidence={result.confidence} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {result.provider === 'aliexpress' ? 'AliExpress' : 'CJ Dropshipping'}
            {result.shippingEstimateDays ? ` · ~${result.shippingEstimateDays}d shipping` : ''}
            {result.supplierRating ? ` · ${result.supplierRating}★` : ''}
          </p>
          <p className="mt-2 text-[11px] text-ink-faint">Confirm the two images match before trusting the cost — matters most for medium confidence.</p>
        </>
      )}

      {/* No match — plain, non-blocking */}
      {looked && !result && !loading && (
        <p className="mt-3 text-sm text-ink-muted">No sourcing match found. You can still proceed and upload your own product in the next step.</p>
      )}

      {notice && <p className="mt-2 text-[11px] text-ink-faint">{notice}</p>}
      {error && <p className="mt-2 text-[11px] text-amber-300">{error}</p>}

      {/* CJ Dropshipping fulfillment handoff — separate concern from the price-check */}
      <a href={cjUrl} target="_blank" rel="noreferrer"
        className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm">
        <LinkIcon className="h-4 w-4" /> Fulfill via CJ Dropshipping
      </a>
    </div>
  )
}

function DetailDrawer({ ad, onClose, onClone }: { ad: SourceAd; onClose: () => void; onClone: () => void }) {
  const f = ad.score.factors
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/[0.08] bg-void-900"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <p className="text-sm font-bold text-ink">Ad detail</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-white/[0.06] hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {ad.creative.mediaUrls[0] && (
            <img src={ad.creative.mediaUrls[0]} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{ad.product.name ?? ad.pageOrShopName}</p>
              <p className="truncate text-xs text-ink-muted">{ad.pageOrShopName} · {ad.platform}</p>
            </div>
            <ScoreBadge rating={ad.score.rating} total={ad.score.total} />
          </div>

          {/* Creative copy */}
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-void-800/60 p-4">
            {ad.creative.headline && <p className="text-sm font-semibold text-ink">{ad.creative.headline}</p>}
            {ad.creative.bodyText && <p className="text-sm leading-relaxed text-ink-muted">{ad.creative.bodyText}</p>}
            {ad.creative.cta && <span className="inline-block rounded-md bg-fire-start/15 px-2 py-1 text-xs font-semibold text-fire-start">{ad.creative.cta}</span>}
          </div>

          {/* Score breakdown */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Opportunity score</p>
            <FactorRow label="Longevity" value={f.longevity.value} signal={f.longevity.rawSignal} />
            <FactorRow label="Reach proxy" value={f.reachProxy.value} signal={f.reachProxy.rawSignal} />
            <FactorRow label="Sourceability" value={f.sourceability.value} signal={f.sourceability.rawSignal} />
            <FactorRow label="Clone complexity" value={f.cloneComplexity.value} signal={f.cloneComplexity.rawSignal} />
            <p className="text-[11px] text-ink-faint">Estimated from public signals — not a guarantee of performance.</p>
          </div>

          {/* Sourcing match — live lookup + CJ fulfillment handoff */}
          <SourcingPanel ad={ad} />
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button onClick={onClone} className="btn-fire w-full">
            <Wand className="h-4 w-4" /> Clone this
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Clone confirmation modal ──────────────────────────────────────────────────
function CloneConfirm({ ad, onCancel, onConfirm }: { ad: SourceAd; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] grid place-items-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-void-900 p-6"
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-fire-start/15">
            <Spark className="h-6 w-6 text-fire-start" />
          </div>
          <p className="mt-4 text-lg font-bold text-ink">Clone this ad's winning structure</p>
          <p className="mt-1 text-xs font-semibold text-fire-start">{ad.product.name ?? ad.creative.headline ?? ad.pageOrShopName}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Claude will analyze this ad's hook and structure, then write you a <span className="font-semibold text-ink">differentiated</span> script and creative direction — <span className="font-semibold text-ink">not a copy</span>. You'll land in the campaign wizard with creator, style, and script pre-filled and fully editable.
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={onCancel} className="btn-ghost flex-1 py-2.5">Cancel</button>
            <button onClick={onConfirm} className="btn-fire flex-1 py-2.5">
              <Wand className="h-4 w-4" /> Analyze & clone
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Phase = 'entry' | 'search' | 'searching' | 'results' | 'cloning'

export default function Discovery() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('entry')
  const [workflow, setWorkflow] = useState<Workflow>('has_product')

  const [queryValue, setQueryValue] = useState('')
  const [platform, setPlatform] = useState<PlatformFilter>('both')
  const [searchDone, setSearchDone] = useState(0)
  const [response, setResponse] = useState<AdSearchResponse | null>(null)
  const [searchError, setSearchError] = useState('')

  const [ratingFilter, setRatingFilter] = useState<ScoreRating | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('score')

  const [openAd, setOpenAd] = useState<SourceAd | null>(null)
  const [confirmAd, setConfirmAd] = useState<SourceAd | null>(null)
  const [analyzeDone, setAnalyzeDone] = useState(0)
  const [cloneError, setCloneError] = useState('')

  const isUrl = workflow === 'find_product'
  const placeholder = isUrl ? 'Paste a product URL — or a niche keyword' : 'e.g. vitamin c serum, resistance band, pet brush'

  async function handleSearch() {
    if (!queryValue.trim()) return
    setSearchError('')
    setPhase('searching')
    setSearchDone(0)
    // Animate the stage feed while the request runs.
    const ticker = setInterval(() => setSearchDone(d => Math.min(d + 1, SEARCH_STAGES.length - 1)), 550)
    try {
      const type = isUrl && /^https?:\/\//i.test(queryValue) ? 'product_url' : 'keyword'
      const resp = await runDiscoverySearch({ type, value: queryValue.trim(), platform })
      clearInterval(ticker)
      setSearchDone(SEARCH_STAGES.length)
      setResponse(resp)
      setPhase('results')
    } catch (err) {
      clearInterval(ticker)
      setSearchError(err instanceof Error ? err.message : 'Search failed.')
      setPhase('search')
    }
  }

  async function handleConfirmClone() {
    const ad = confirmAd
    if (!ad) return
    setConfirmAd(null)
    setOpenAd(null)
    setCloneError('')
    setPhase('cloning')
    setAnalyzeDone(0)
    const ticker = setInterval(() => setAnalyzeDone(d => Math.min(d + 1, ANALYZE_STAGES.length - 1)), 700)
    try {
      const { analysis } = await analyzeSourceAd(ad)
      clearInterval(ticker)
      setAnalyzeDone(ANALYZE_STAGES.length)
      const prefill: ClonePrefill = {
        sourceAdId: ad.id,
        sourceAdName: ad.product.name ?? ad.creative.headline ?? ad.pageOrShopName,
        analysis: analysis as AdAnalysis,
        sourcedProduct: workflow === 'find_product'
          ? { name: ad.product.name ?? '', imageUrl: ad.product.matchedSourcingResult?.matchedImageUrl ?? ad.creative.mediaUrls[0], sourceUrl: ad.product.sourceUrl }
          : undefined,
        appliedAt: new Date().toISOString(),
      }
      try { sessionStorage.setItem(CLONE_PREFILL_KEY, JSON.stringify(prefill)) } catch {}
      // Brief beat so the final stage reads as complete before routing.
      setTimeout(() => navigate('/studio/new'), 600)
    } catch (err) {
      clearInterval(ticker)
      setCloneError(err instanceof Error ? err.message : 'Analysis failed.')
      setPhase('results')
    }
  }

  // Derived filtered/sorted results.
  const ads = (response?.ads ?? [])
    .filter(a => ratingFilter === 'all' || a.score.rating === ratingFilter)
    .sort((a, b) => {
      if (sortKey === 'days') return b.delivery.daysRunning - a.delivery.daysRunning
      if (sortKey === 'newest') return new Date(b.delivery.startDate).getTime() - new Date(a.delivery.startDate).getTime()
      return b.score.total - a.score.total
    })

  return (
    <AppShell>
      {phase === 'entry' && <EntryChoice onPick={w => { setWorkflow(w); setPhase('search') }} />}

      {(phase === 'search' || phase === 'searching') && (
        <div className="mx-auto max-w-2xl space-y-6">
          <button onClick={() => setPhase('entry')} className="text-xs font-semibold text-ink-faint hover:text-ink">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-ink">{isUrl ? 'Find a winning product' : 'Search ad libraries'}</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{isUrl ? 'Paste a product URL or search a niche to reverse-search running ads.' : 'Search a niche to see scored, currently-running ads.'}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-void-800 px-4 py-3 focus-within:border-fire-start/40">
              <Search className="h-5 w-5 flex-shrink-0 text-ink-faint" />
              <input
                value={queryValue}
                onChange={e => setQueryValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && phase === 'search' && handleSearch()}
                placeholder={placeholder}
                disabled={phase === 'searching'}
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-faint">Platform</span>
              {(['both', 'meta', 'tiktok'] as PlatformFilter[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  disabled={phase === 'searching'}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${platform === p ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30' : 'bg-void-800 text-ink-muted hover:text-ink'}`}
                >
                  {p === 'both' ? 'Both' : p}
                </button>
              ))}
            </div>

            {searchError && <p className="text-sm text-rose-300">{searchError}</p>}

            {phase === 'search'
              ? (
                <button onClick={handleSearch} disabled={!queryValue.trim()} className="btn-fire w-full disabled:opacity-40">
                  <Compass className="h-4 w-4" /> Search
                </button>
              )
              : <LogFeed title="Searching ad libraries…" stages={SEARCH_STAGES} doneCount={searchDone} />}
          </div>
        </div>
      )}

      {(phase === 'results' || phase === 'cloning') && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button onClick={() => setPhase('search')} className="text-xs font-semibold text-ink-faint hover:text-ink">← New search</button>
              <h1 className="mt-1 text-xl font-bold text-ink">{response?.resultCount ?? 0} ad{response?.resultCount === 1 ? '' : 's'} for “{queryValue}”</h1>
            </div>
          </div>

          {response?.notice && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5">
              <Bolt className="h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
              <p className="text-xs text-ink-muted">{response.notice}</p>
            </div>
          )}

          {cloneError && <p className="text-sm text-rose-300">{cloneError}</p>}

          {/* Filter / sort bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'green', 'yellow', 'red'] as const).map(r => (
              <button key={r} onClick={() => setRatingFilter(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${ratingFilter === r ? 'bg-fire-start/15 text-fire-start ring-1 ring-fire-start/30' : 'bg-void-800 text-ink-muted hover:text-ink'}`}>
                {r === 'all' ? 'All scores' : RATING_STYLES[r].label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-ink-faint">Sort</span>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                className="rounded-lg border border-white/[0.08] bg-void-800 px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-fire-start/40 focus:outline-none">
                <option value="score">Score</option>
                <option value="days">Days running</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {phase === 'cloning' && (
            <LogFeed title="Cloning the winning structure…" stages={ANALYZE_STAGES} doneCount={analyzeDone} />
          )}

          {ads.length === 0
            ? <div className="rounded-2xl border border-white/[0.08] bg-void-800 p-10 text-center text-sm text-ink-muted">No ads match these filters.</div>
            : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {ads.map(ad => <AdCard key={ad.id} ad={ad} onOpen={() => setOpenAd(ad)} />)}
              </div>
            )}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {openAd && (
          <DetailDrawer
            ad={openAd}
            onClose={() => setOpenAd(null)}
            onClone={() => setConfirmAd(openAd)}
          />
        )}
      </AnimatePresence>

      {/* Clone confirm */}
      <AnimatePresence>
        {confirmAd && (
          <CloneConfirm ad={confirmAd} onCancel={() => setConfirmAd(null)} onConfirm={handleConfirmClone} />
        )}
      </AnimatePresence>
    </AppShell>
  )
}
