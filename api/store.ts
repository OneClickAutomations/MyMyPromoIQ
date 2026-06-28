/**
 * POST /api/store — server-side persistence for campaigns + scenes.
 *
 * Why this exists: the browser cannot write to Supabase directly because RLS
 * (auth.jwt()->>'sub' = user_id) requires the Clerk↔Supabase JWT bridge to be
 * configured. This endpoint uses the Supabase SERVICE KEY (server-only, already
 * configured for uploads) which bypasses RLS, so saving/reading history works
 * regardless of that bridge.
 *
 * Body: { action, userId, ... }
 *   saveCampaign { userId, campaign }     → { id }
 *   saveScene    { userId, scene }         → { id }
 *   get          { userId, campaignId }    → { campaign, scenes }
 *   list         { userId }                → { campaigns, videos, videoCount }
 *   delete       { userId, campaignId }    → { ok: true }
 *
 * Note: userId is currently trusted from the client. The service key never
 * leaves the server. Harden later by verifying the Clerk token server-side.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function db(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase is not configured (need VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY).')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const body = (req.body ?? {}) as Record<string, any>
    const { action, userId } = body
    if (!userId) return res.status(400).json({ error: 'userId is required.' })

    const supabase = db()

    switch (action) {
      case 'saveCampaign': {
        const c = (body.campaign ?? {}) as Record<string, any>
        const row = {
          user_id: userId,
          name: c.name ?? 'Untitled Campaign',
          product_image_url: c.product_image_url ?? null,
          product_description: c.product_description ?? null,
          style: c.style ?? null,
          quality: c.quality ?? 'turbo',
          status: c.status ?? 'rendering',
          ...(c.id ? { id: c.id } : {}),
        }
        const { data, error } = await supabase
          .from('campaigns').upsert(row).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ id: data.id })
      }

      case 'saveScene': {
        const s = (body.scene ?? {}) as Record<string, any>
        if (!s.campaign_id) return res.status(400).json({ error: 'scene.campaign_id is required.' })
        const row = {
          user_id: userId,
          campaign_id: s.campaign_id,
          label: s.label ?? 'Scene',
          style: s.style ?? 'testimonial',
          order_index: s.order_index ?? 0,
          phase: s.phase ?? 'idle',
          request_id: s.request_id ?? null,
          director_prompt: s.director_prompt ?? null,
          video_url: s.video_url ?? null,
          error_message: s.error_message ?? null,
          ...(s.id ? { id: s.id } : {}),
        }
        const { data, error } = await supabase
          .from('scenes').upsert(row).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ id: data.id })
      }

      case 'get': {
        const { campaignId } = body
        if (!campaignId) return res.status(400).json({ error: 'campaignId is required.' })
        const { data: campaign } = await supabase
          .from('campaigns').select('*').eq('id', campaignId).eq('user_id', userId).single()
        const { data: scenes } = await supabase
          .from('scenes').select('*').eq('campaign_id', campaignId).eq('user_id', userId).order('order_index')
        return res.status(200).json({ campaign: campaign ?? null, scenes: scenes ?? [] })
      }

      case 'list': {
        const { data: campaigns } = await supabase
          .from('campaigns').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(60)
        const ids = (campaigns ?? []).map((c: any) => c.id)
        const videos: Record<string, string> = {}
        let videoCount = 0
        if (ids.length) {
          const { data: doneScenes } = await supabase
            .from('scenes').select('campaign_id, video_url, updated_at')
            .in('campaign_id', ids).eq('phase', 'done').not('video_url', 'is', null)
            .order('updated_at', { ascending: false })
          for (const s of doneScenes ?? []) {
            videoCount++
            if (s.campaign_id && s.video_url && !videos[s.campaign_id]) videos[s.campaign_id] = s.video_url
          }
        }
        return res.status(200).json({ campaigns: campaigns ?? [], videos, videoCount })
      }

      case 'delete': {
        const { campaignId } = body
        if (!campaignId) return res.status(400).json({ error: 'campaignId is required.' })
        await supabase.from('scenes').delete().eq('campaign_id', campaignId).eq('user_id', userId)
        const { error } = await supabase.from('campaigns').delete().eq('id', campaignId).eq('user_id', userId)
        if (error) throw new Error(error.message)
        return res.status(200).json({ ok: true })
      }

      case 'saveBrief': {
        const b = (body.brief ?? {}) as Record<string, any>
        const row = {
          user_id: userId,
          status: b.status ?? 'draft',
          product: b.product ?? {},
          creator: b.creator ?? {},
          scene: b.scene ?? {},
          style: b.style ?? {},
          voice: b.voice ?? {},
          script: b.script ?? {},
          storyboard: b.storyboard ?? {},
          render: b.render ?? {},
          ...(b.id ? { id: b.id } : {}),
        }
        const { data, error } = await supabase
          .from('creative_briefs').upsert(row).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ id: data.id })
      }

      case 'getBrief': {
        const { briefId } = body
        if (!briefId) return res.status(400).json({ error: 'briefId is required.' })
        const { data, error } = await supabase
          .from('creative_briefs').select('*').eq('id', briefId).eq('user_id', userId).single()
        if (error) return res.status(404).json({ error: 'Brief not found.' })
        return res.status(200).json({ brief: data })
      }

      case 'listBriefs': {
        const { data } = await supabase
          .from('creative_briefs').select('id,status,product,style,created_at,updated_at')
          .eq('user_id', userId).order('updated_at', { ascending: false }).limit(40)
        return res.status(200).json({ briefs: data ?? [] })
      }

      // ── Creator CRUD ──────────────────────────────────────────────────────────

      case 'saveCreator': {
        const c = (body.creator ?? {}) as Record<string, any>
        const row = {
          user_id: userId,
          name: c.name ?? 'Untitled Creator',
          mode: c.mode ?? 'generated',
          attributes: c.attributes ?? {},
          seed_images: c.seed_images ?? [],
          ...(c.id ? { id: c.id } : {}),
        }
        const { data, error } = await supabase.from('creators').upsert(row).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ id: data.id })
      }

      case 'listCreators': {
        const { data } = await supabase
          .from('creators').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(50)
        return res.status(200).json({ creators: data ?? [] })
      }

      case 'deleteCreator': {
        const { creatorId } = body
        if (!creatorId) return res.status(400).json({ error: 'creatorId required.' })
        await supabase.from('creators').delete().eq('id', creatorId).eq('user_id', userId)
        return res.status(200).json({ ok: true })
      }

      // ── Product CRUD ──────────────────────────────────────────────────────────

      case 'saveProduct': {
        const p = (body.product ?? {}) as Record<string, any>
        const row = {
          user_id: userId,
          name: p.name ?? 'Untitled Product',
          brand: p.brand ?? null,
          category: p.category ?? null,
          primary_image_url: p.primary_image_url ?? null,
          images: p.images ?? [],
          description: p.description ?? null,
          features: p.features ?? [],
          benefits: p.benefits ?? [],
          target_audience: p.target_audience ?? null,
          logo_url: p.logo_url ?? null,
          colors: p.colors ?? [],
          default_prompt: p.default_prompt ?? null,
          ...(p.id ? { id: p.id } : {}),
        }
        const { data, error } = await supabase.from('product_profiles').upsert(row).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ id: data.id })
      }

      case 'listProducts': {
        const { data } = await supabase
          .from('product_profiles').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(50)
        return res.status(200).json({ products: data ?? [] })
      }

      case 'deleteProduct': {
        const { productId } = body
        if (!productId) return res.status(400).json({ error: 'productId required.' })
        await supabase.from('product_profiles').delete().eq('id', productId).eq('user_id', userId)
        return res.status(200).json({ ok: true })
      }

      // ── Brand Kit CRUD ────────────────────────────────────────────────────────

      case 'saveBrand': {
        const b = (body.brand ?? {}) as Record<string, any>
        const row = {
          user_id: userId,
          name: b.name ?? 'My Brand',
          logo_url: b.logo_url ?? null,
          primary_colors: b.primary_colors ?? [],
          secondary_colors: b.secondary_colors ?? [],
          brand_voice: b.brand_voice ?? null,
          taglines: b.taglines ?? [],
          target_audience: b.target_audience ?? null,
          industry: b.industry ?? null,
          brand_guidelines: b.brand_guidelines ?? null,
          cta_preferences: b.cta_preferences ?? null,
          ...(b.id ? { id: b.id } : {}),
        }
        const { data, error } = await supabase.from('brand_kits').upsert(row).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ id: data.id })
      }

      case 'getBrand': {
        const { data } = await supabase
          .from('brand_kits').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(1)
        return res.status(200).json({ brand: (data ?? [])[0] ?? null })
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[/api/store]', err)
    const message = err instanceof Error ? err.message : 'Store request failed.'
    return res.status(502).json({ error: message })
  }
}
