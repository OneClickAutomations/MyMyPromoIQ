/**
 * Client-side product photo tools — deterministic, no AI model in the loop.
 *
 * "Remove background" and "Enhance photo" previously routed through
 * Higgsfield Soul (mode 'edit' on /api/modelsheet). Soul is a single-subject
 * STYLIZED GENERATOR, not an instruction-following pixel editor (documented
 * in api/modelsheet.ts's own comments), and this account's verified model
 * catalog has no dedicated cutout/upscale endpoint — so asking Soul to
 * "remove the background, keep the product pixel-accurate" was unreliable at
 * best. These run entirely in the browser instead: always available, instant,
 * and predictable.
 */

/** Load a data URL into an HTMLImageElement. */
function loadImageEl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the image.'))
    img.src = dataUrl
  })
}

/**
 * Remove a solid/plain background via edge-connected flood fill (chroma key).
 * Samples the background color from the four corners, then flood-fills from
 * every border pixel, marking pixels transparent while they stay within a
 * color-distance threshold of the sampled background — so background-colored
 * regions ENCLOSED by the product (e.g. a white logo on a white backdrop
 * product) are left alone, only the connected backdrop is cut out.
 *
 * This is the standard, reliable technique for e-commerce product photos shot
 * on a plain/solid backdrop (the overwhelming majority of product photos) —
 * it does not attempt to segment complex photographic backgrounds.
 */
export async function removeBackgroundClientSide(dataUrl: string): Promise<string> {
  const img = await loadImageEl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  ctx.drawImage(img, 0, 0)

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  // Sample the background color from the four corners (average them — a
  // vignette or slight gradient still averages close to the true backdrop).
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ]
  let br = 0, bg = 0, bb = 0
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2] }
  br /= corners.length; bg /= corners.length; bb /= corners.length

  const THRESHOLD = 42 // color-distance tolerance — plain backdrops have low internal variance
  const dist = (r: number, g: number, b: number) => Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2)

  // BFS flood fill from every border pixel that matches the background color.
  const visited = new Uint8Array(width * height)
  const queue: number[] = []
  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const idx = y * width + x
    if (visited[idx]) return
    const p = idx * 4
    if (dist(data[p], data[p + 1], data[p + 2]) <= THRESHOLD) {
      visited[idx] = 1
      queue.push(idx)
    }
  }
  for (let x = 0; x < width; x++) { pushIfBg(x, 0); pushIfBg(x, height - 1) }
  for (let y = 0; y < height; y++) { pushIfBg(0, y); pushIfBg(width - 1, y) }

  while (queue.length) {
    const idx = queue.pop()!
    const x = idx % width
    const y = (idx / width) | 0
    data[idx * 4 + 3] = 0 // make transparent
    pushIfBg(x + 1, y); pushIfBg(x - 1, y); pushIfBg(x, y + 1); pushIfBg(x, y - 1)
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Enhance a product photo: auto-contrast (percentile-clipped levels stretch)
 * plus a mild unsharp-mask sharpen. Deterministic and instant — no model call.
 */
export async function enhancePhotoClientSide(dataUrl: string): Promise<string> {
  const img = await loadImageEl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  ctx.drawImage(img, 0, 0)

  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const n = data.length

  // ── Auto-levels: stretch each channel's histogram between its 0.5th and
  //    99.5th percentile, clipping outliers so a few stray dark/bright pixels
  //    don't compress the whole stretch.
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  for (let i = 0; i < n; i += 4) {
    hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++
  }
  const pixelCount = n / 4
  const clip = pixelCount * 0.005
  const bounds = hist.map(h => {
    let lo = 0, hi = 255, acc = 0
    for (lo = 0; lo < 255; lo++) { acc += h[lo]; if (acc > clip) break }
    acc = 0
    for (hi = 255; hi > 0; hi--) { acc += h[hi]; if (acc > clip) break }
    return hi > lo ? [lo, hi] as const : [0, 255] as const
  })

  const stretch = (v: number, lo: number, hi: number) => {
    const out = ((v - lo) / (hi - lo)) * 255
    return out < 0 ? 0 : out > 255 ? 255 : out
  }
  for (let i = 0; i < n; i += 4) {
    data[i] = stretch(data[i], bounds[0][0], bounds[0][1])
    data[i + 1] = stretch(data[i + 1], bounds[1][0], bounds[1][1])
    data[i + 2] = stretch(data[i + 2], bounds[2][0], bounds[2][1])
  }

  // ── Mild unsharp mask: blend the original with (original - gaussian blur).
  const blurred = new Uint8ClampedArray(data.length)
  boxBlur3(data, blurred, width, height)
  const AMOUNT = 0.5
  for (let i = 0; i < n; i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = data[i + c]
      const sharp = orig + (orig - blurred[i + c]) * AMOUNT
      data[i + c] = sharp < 0 ? 0 : sharp > 255 ? 255 : sharp
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

/** Simple 3x3 box blur (separable-enough approximation for an unsharp mask at this scale). */
function boxBlur3(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const p = (ny * width + nx) * 4
          r += src[p]; g += src[p + 1]; b += src[p + 2]; a += src[p + 3]
          count++
        }
      }
      const p = (y * width + x) * 4
      dst[p] = r / count; dst[p + 1] = g / count; dst[p + 2] = b / count; dst[p + 3] = a / count
    }
  }
}
