/**
 * Client-side product spec sheet compositor.
 *
 * The old "turnaround" tried to AI-regenerate a 2x3 multi-angle grid from a
 * single photo via Higgsfield Soul — but Soul is a single-subject stylized
 * generator, not an instruction-following compositor, so it could not
 * reliably lay out six consistent angles. Results were unpredictable and
 * failures were silent (a 200 response with an image that just isn't a
 * turnaround grid).
 *
 * This replaces that with a deterministic canvas composite: the user's OWN
 * uploaded angle photos (already real, already accurate) laid out on a
 * grid, with a legend panel of Claude-estimated dimensions/material/scale/
 * notes. Zero AI image generation in the loop — it cannot silently fail the
 * way a generative call can, and it gives the video/image models sharper
 * scale context than a hallucinated grid ever could.
 */
import type { ProductSpec } from './api'

const CELL = 480 // px, square cell size at 2x export scale (rendered /2 in CSS)
const COLS = 3
const PAD = 24
const LEGEND_H = 220

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load an image for the spec sheet.'))
    img.src = src
  })
}

/**
 * Load an image for canvas drawing WITHOUT tainting the canvas.
 *
 * data: URLs load directly — same-origin by definition, never tainted.
 * https URLs are fetched and converted to a data: URL first: setting
 * `img.crossOrigin = 'anonymous'` on the <img> tag directly is the more
 * common approach, but it makes the load FAIL outright (onerror, no image at
 * all) on any host that doesn't send an Access-Control-Allow-Origin header —
 * which silently killed the whole spec sheet with no visible feedback. The
 * fetch+blob route degrades to a clear, catchable error instead of a dead end.
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  if (src.startsWith('data:')) return loadImageEl(src)
  const resp = await fetch(src)
  if (!resp.ok) throw new Error(`Could not fetch a reference photo (${resp.status}).`)
  const blob = await resp.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read a reference photo.'))
    reader.readAsDataURL(blob)
  })
  return loadImageEl(dataUrl)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Compose a product spec sheet from real photos + a Claude-estimated spec.
 * Returns a PNG data URL. `images` should be 1-6 real product photos (data
 * URLs or https URLs already same-origin/CORS-enabled via Supabase Storage).
 */
export async function composeSpecSheet(
  images: string[],
  spec: ProductSpec | null,
  productName?: string,
): Promise<string> {
  const photos = images.slice(0, 6)
  if (photos.length === 0) throw new Error('No photos to compose a spec sheet from.')

  const rows = Math.ceil(photos.length / COLS)
  const gridW = COLS * CELL + (COLS + 1) * PAD
  const gridH = rows * CELL + (rows + 1) * PAD
  const width = gridW
  const height = gridH + LEGEND_H

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  // White background — this sheet is machine-reading context, not branded UI.
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // Photo grid, each cell letterboxed to preserve the real photo's proportions.
  const loaded = await Promise.all(photos.map(loadImage))
  loaded.forEach((img, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = PAD + col * (CELL + PAD)
    const y = PAD + row * (CELL + PAD)

    ctx.fillStyle = '#F4F4F2'
    ctx.fillRect(x, y, CELL, CELL)
    ctx.strokeStyle = '#D8D8D5'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, CELL, CELL)

    const scale = Math.min(CELL / img.width, CELL / img.height) * 0.92
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh)

    const label = i === 0 ? 'HERO' : `ANGLE ${i + 1}`
    ctx.font = 'bold 14px Inter, system-ui, sans-serif' // set BEFORE measureText, or the badge is measured with the wrong font
    ctx.fillStyle = '#00000099'
    ctx.fillRect(x + 8, y + 8, ctx.measureText(label).width + 24, 28)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(label, x + 18, y + 27)
  })

  // Legend strip.
  const legendY = gridH
  ctx.fillStyle = '#111113'
  ctx.fillRect(0, legendY, width, LEGEND_H)

  const lx = PAD
  let ly = legendY + 40
  ctx.fillStyle = '#FF6B35'
  ctx.font = 'bold 20px Inter, system-ui, sans-serif'
  ctx.fillText((productName || 'PRODUCT').toUpperCase() + ' — REFERENCE SPEC', lx, ly)

  ly += 34
  ctx.font = '15px Inter, system-ui, sans-serif'
  const fields: Array<[string, string]> = [
    ['Dimensions', spec?.dimensions || 'Not estimated'],
    ['Material', spec?.material || 'Not estimated'],
    ['Scale', spec?.scaleComparison || 'Not estimated'],
  ]
  const colW = (width - PAD * 2) / 3
  fields.forEach(([label, value], i) => {
    const fx = lx + i * colW
    ctx.fillStyle = '#8A8A92'
    ctx.font = 'bold 11px Inter, system-ui, sans-serif'
    ctx.fillText(label.toUpperCase(), fx, ly)
    ctx.fillStyle = '#F5F5F4'
    ctx.font = '14px Inter, system-ui, sans-serif'
    const lines = wrapText(ctx, value, colW - 20)
    lines.slice(0, 2).forEach((line, li) => ctx.fillText(line, fx, ly + 20 + li * 18))
  })

  if (spec?.notes) {
    ly += 70
    ctx.fillStyle = '#8A8A92'
    ctx.font = 'bold 11px Inter, system-ui, sans-serif'
    ctx.fillText('NOTES FOR VIDEO GENERATION', lx, ly)
    ctx.fillStyle = '#F5F5F4'
    ctx.font = '14px Inter, system-ui, sans-serif'
    const lines = wrapText(ctx, spec.notes, width - PAD * 2)
    lines.slice(0, 2).forEach((line, li) => ctx.fillText(line, lx, ly + 20 + li * 18))
  }

  return canvas.toDataURL('image/png')
}
