/**
 * HistoryGrid — the user's previously generated content.
 *
 * Self-contained: fetches campaigns + their finished videos, renders cards
 * with per-item actions (open/edit, regenerate, download, delete). Used by
 * both the Dashboard ("History" section) and the dedicated /history page.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { Download, Edit, Film, Plus, RefreshCw, Trash } from './icons'
import { listCampaigns, deleteCampaignRemote, listBriefs, type StoredCampaign, type StoredBriefSummary } from '../lib/api'

type Campaign = StoredCampaign

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-ink-faint',
  rendering: 'text-gold',
  ready: 'text-fire-start',
  published: 'text-fire-start',
}

type Props = {
  /** Max items to load (default 60). */
  limit?: number
  /** Rendered when the user has no campaigns yet. */
  emptyState?: ReactNode
}

export default function HistoryGrid({ limit = 60, emptyState }: Props) {
  const { user } = useUser()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [drafts, setDrafts] = useState<StoredBriefSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [videoByCampaign, setVideoByCampaign] = useState<Record<string, string>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    async function load() {
      try {
        const [{ campaigns: rows, videos }, { briefs }] = await Promise.all([
          listCampaigns(user!.id),
          listBriefs(user!.id).catch(() => ({ briefs: [] as StoredBriefSummary[] })),
        ])
        if (cancelled) return
        setCampaigns(rows.slice(0, limit))
        setVideoByCampaign(videos)
        // Only show briefs that are still in draft status (not yet rendered)
        setDrafts(briefs.filter(b => b.status === 'draft').slice(0, 20))
      } catch {
        // Persistence unavailable — fail silently (shows empty state)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, limit])

  async function deleteCampaign(id: string) {
    if (!user?.id) return
    if (!window.confirm('Delete this campaign and all of its videos? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteCampaignRemote(user.id, id)
      setCampaigns(prev => prev.filter(c => c.id !== id))
    } catch {
      window.alert('Could not delete the campaign. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-void-800/40 p-3 md:p-4">
            <div className="aspect-[9/16] rounded-xl bg-void-700/60 animate-pulse" />
            <div className="mt-3 h-3 w-2/3 rounded-full bg-void-700/60 animate-pulse" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-void-600/40 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (campaigns.length === 0 && drafts.length === 0) {
    return (
      <>
        {emptyState ?? (
          <div className="rounded-2xl border border-dashed border-white/[0.10] px-6 py-12 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-fire shadow-fire-soft">
              <Film className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-ink">No content yet</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-muted">
              Generate your first video and it will show up here, ready to revisit, download, or regenerate.
            </p>
            <Link to="/studio" className="btn-fire mx-auto mt-6 inline-flex gap-2">
              <Plus className="h-4 w-4" /> Create a campaign
            </Link>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Drafts section ── */}
      {drafts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-ink-faint">Drafts</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map(d => {
              const prod = d.product as Record<string, unknown>
              const name = (prod?.productName as string) || 'Untitled draft'
              const imgUrl = prod?.productImageUrl as string | undefined
              const lastEdited = new Date(d.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <div key={d.id} className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-void-800/50 p-4">
                  {imgUrl ? (
                    <img src={imgUrl} alt={name} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-xl bg-void-700">
                      <Film className="h-6 w-6 text-ink-faint/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{name}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">Last edited {lastEdited}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/studio/new?brief=${d.id}`)}
                    className="flex-shrink-0 rounded-xl border border-fire-start/40 bg-fire-start/10 px-3.5 py-2 text-xs font-bold text-fire-start transition-colors hover:bg-fire-start/20"
                  >
                    Resume
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {campaigns.length > 0 && drafts.length > 0 && (
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Published</h2>
      )}

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {campaigns.map((c) => {
        const videoUrl = videoByCampaign[c.id]
        const open = () => navigate(`/studio?campaign=${c.id}`)
        return (
          <div
            key={c.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-void-800/50 transition-all duration-200 hover:border-white/[0.16] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)]"
          >
            <button
              type="button"
              onClick={open}
              className="relative block aspect-[9/16] w-full overflow-hidden bg-void-700/60"
              aria-label={`Open ${c.name}`}
            >
              {videoUrl ? (
                <video
                  src={`${videoUrl}#t=0.1`}
                  poster={c.product_image_url ?? undefined}
                  muted loop playsInline preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : c.product_image_url ? (
                <img src={c.product_image_url} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Film className="h-7 w-7 text-ink-faint/40" />
                </div>
              )}

              {/* Hover action toolbar */}
              <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <span
                  onClick={(e) => { e.stopPropagation(); open() }}
                  title="Open / edit"
                  className="grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm ring-1 ring-white/15 hover:bg-black/80 transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); open() }}
                  title="Regenerate"
                  className="grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm ring-1 ring-white/15 hover:bg-black/80 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </span>
                {videoUrl && (
                  <a
                    href={videoUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Download video"
                    className="grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm ring-1 ring-white/15 hover:bg-black/80 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
                <span
                  onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id) }}
                  title="Delete"
                  className={`grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white backdrop-blur-sm ring-1 ring-white/15 transition-colors hover:bg-red-600/80 ${deletingId === c.id ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Trash className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>

            <button type="button" onClick={open} className="px-3 pb-3 pt-2.5 text-left md:px-3.5">
              <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-ink-faint capitalize">{c.style?.replace('-', ' ') ?? 'custom'}</p>
                <span className={`text-[10px] font-bold capitalize ${STATUS_COLORS[c.status] ?? 'text-ink-faint'}`}>
                  {c.status}
                </span>
              </div>
            </button>
          </div>
        )
      })}
      {/* New campaign card */}
      <Link
        to="/studio"
        className="group flex aspect-auto flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.10] p-6 text-center transition-all duration-200 hover:border-fire-start/30 hover:bg-fire-start/[0.03]"
      >
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-dashed border-white/10 transition-colors group-hover:border-fire-start/30">
          <Plus className="h-5 w-5 text-ink-faint group-hover:text-fire-start transition-colors" />
        </div>
        <p className="mt-2.5 text-sm font-medium text-ink-faint group-hover:text-ink transition-colors">New campaign</p>
      </Link>
    </div>

    </div>
  )
}
