/**
 * POST /api/modelsheet
 * Body: { imageUrl? | imageBase64?, mimeType?, subjectType: 'product'|'character', subjectHint? }
 *
 * Turns ONE uploaded reference photo into a 2x3 multi-angle turnaround "model
 * sheet" — six consistent views on a clean background. Used as a consistency
 * reference for the creator/product before video generation. (Higgsfield is NOT
 * sent multiple images; this produces a single composite reference asset.)
 *
 * Pipeline:
 *   1. Claude vision derives a precise subject phrase (best-effort).
 *   2. Build the turnaround prompt (10x of the user's template).
 *   3. Gemini 2.5 Flash Image ("nano-banana") renders the sheet FROM the photo,
 *      keeping the subject identity consistent across angles.
 *
 * Requires GEMINI_API_KEY. ANTHROPIC_API_KEY enhances the prompt but isn't
 * required (Gemini also sees the image directly). Self-contained.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation'

function buildPrompt(subjectType: 'product' | 'character', subject: string): string {
  if (subjectType === 'character') {
    return `A professional character turnaround model sheet of ${subject}. Strict 2x3 grid layout (2 rows, 3 columns) showing the SAME person as a multi-angle reference turnaround. The six cells, in order, are distinct views: (1) front view, (2) three-quarter front view, (3) left profile side view, (4) three-quarter back view, (5) full back view, (6) front close-up of the face. The identity must stay PERFECTLY consistent across all six cells — identical face, skin tone, facial features, hairstyle, body type, age, and wardrobe, lit identically in every cell. Neutral relaxed A-pose, full body where shown, neutral calm expression. Clean seamless light-grey studio background, soft even key lighting, photorealistic natural skin texture with visible pores (never plastic, waxy, or airbrushed). High-definition photography, sharp focus, accurate color, orthographic projection with minimal perspective distortion, each cell evenly spaced and centered. No text, no labels, no callouts, no measurement lines, no watermark, no logos. Consistent, production-ready character model sheet.`
  }
  return `A professional studio asset model sheet of ${subject}. Strict 2x3 grid layout (2 rows, 3 columns) showing the SAME identical object as a multi-angle view turnaround. The six cells, in order, are distinct camera angles: (1) front view, (2) left profile side view, (3) three-quarter front view, (4) top-down view, (5) bottom view, (6) rear/back view. The object must stay PERFECTLY consistent across all six cells — identical color, materials, proportions, label text, and surface details, at the same scale and lit identically. Clean seamless pure-white background (#FFFFFF), soft even studio softbox lighting, no harsh shadows, only a subtle contact shadow. High-definition product photography, sharp focus, color-accurate, isometric orthographic projection with minimal perspective distortion. Each cell evenly spaced and centered. No text, no labels, no callouts, no measurement lines, no watermark, no logos, no people, no hands. Photorealistic, production-ready asset sheet.`
}

async function resolveImage(imageUrl?: string, imageBase64?: string, mimeType?: string): Promise<{ data: string; mime: string }> {
  if (imageBase64) {
    const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    const mime = mimeType || (imageBase64.match(/^data:(.*?);base64/)?.[1]) || 'image/png'
    return { data, mime }
  }
  if (imageUrl) {
    const r = await fetch(imageUrl)
    if (!r.ok) throw new Error(`Could not fetch reference image (${r.status}).`)
    const mime = r.headers.get('content-type') || 'image/jpeg'
    const data = Buffer.from(await r.arrayBuffer()).toString('base64')
    return { data, mime }
  }
  throw new Error('Provide an image URL or upload.')
}

async function describeSubject(img: { data: string; mime: string }, subjectType: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return ''
  try {
    const anthropic = new Anthropic()
    const noun = subjectType === 'character' ? 'person/character' : 'product/object'
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.mime as any, data: img.data } },
          { type: 'text', text: `Describe the single main ${noun} in this image as ONE concise phrase with the key visual details (color, material, form, distinctive features) for an image-generation prompt. Output only the phrase, no preamble.` },
        ],
      }],
    })
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
  } catch {
    return ''
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables to enable turnaround model sheets.' })
  }

  const { imageUrl, imageBase64, mimeType, subjectType = 'product', subjectHint } =
    (req.body ?? {}) as Record<string, string>
  const type = subjectType === 'character' ? 'character' : 'product'

  try {
    const img = await resolveImage(imageUrl, imageBase64, mimeType)
    const subject = (subjectHint?.trim()) || (await describeSubject(img, type)) ||
      (type === 'character' ? 'the person shown in the reference image' : 'the product shown in the reference image')
    const prompt = buildPrompt(type, subject)

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: img.mime, data: img.data } },
              { text: prompt },
            ],
          }],
          generationConfig: { temperature: 0.4, responseModalities: ['IMAGE', 'TEXT'] },
        }),
      },
    )

    if (!geminiResp.ok) {
      const detail = await geminiResp.text().catch(() => '')
      return res.status(502).json({ error: `Image generation failed (${geminiResp.status}): ${detail.slice(0, 240)}` })
    }

    const data = (await geminiResp.json()) as any
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p: any) => p.inline_data?.data || p.inlineData?.data)
    const out = imagePart?.inline_data?.data ?? imagePart?.inlineData?.data
    if (!out) {
      return res.status(502).json({ error: 'Image model returned no image. Try a clearer reference photo.' })
    }
    const outMime = imagePart?.inline_data?.mime_type ?? imagePart?.inlineData?.mimeType ?? 'image/png'

    return res.status(200).json({
      sheetDataUrl: `data:${outMime};base64,${out}`,
      subject,
      prompt,
    })
  } catch (err) {
    console.error('[/api/modelsheet]', err)
    const message = err instanceof Error ? err.message : 'Model sheet generation failed.'
    return res.status(502).json({ error: message })
  }
}
