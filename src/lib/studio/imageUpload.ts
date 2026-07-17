/** Read a File from an <input type="file">, resize to ≤1280px on the long
 *  edge, and re-encode as a JPEG data URL — keeps the payload well under
 *  Vercel's request body limit for the AI steps. Mirrors ProductInput.tsx's
 *  resizeToDataUrl, just starting from a File instead of an image src. */
export function fileToResizedDataUrl(file: File, maxDim = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not process image'))
        }
      }
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
