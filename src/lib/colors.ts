/** Dominant colors for the share-card gradient, sampled from the painting itself. */

export type Rgb = [number, number, number]

/** Fallback gradient when the image cannot be read (offline, blocked canvas). Palette colors only. */
export const FALLBACK_GRADIENT: Rgb[] = [
  [61, 90, 128], // Slate Blue
  [107, 102, 97], // Mute Gray
  [31, 29, 27], // Ink
]

const cache = new Map<string, Promise<Rgb[]>>()

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image failed'))
    img.src = src
  })
}

/** Most common quantized color in a block of pixels, weighted a little toward saturated ones. */
function dominant(data: Uint8ClampedArray, start: number, end: number, stride: number): Rgb {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = start; i < end; i += stride) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (data[i + 3] < 128) continue
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    const w = 1 + sat / 128
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n += w
    bucket.r += r * w
    bucket.g += g * w
    bucket.b += b * w
    buckets.set(key, bucket)
  }
  let best: { n: number; r: number; g: number; b: number } | undefined
  for (const b of buckets.values()) if (!best || b.n > best.n) best = b
  if (!best) return FALLBACK_GRADIENT[1]
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)]
}

/**
 * Three colors, one per horizontal band of the image (top, middle, bottom), so the gradient
 * reads like the painting from top to bottom.
 */
export function sampleGradient(src: string): Promise<Rgb[]> {
  const hit = cache.get(src)
  if (hit) return hit
  const p = (async () => {
    try {
      const img = await loadImage(src)
      const w = 48
      const h = 48
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return FALLBACK_GRADIENT
      ctx.drawImage(img, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h).data
      const band = Math.floor(h / 3) * w * 4
      return [0, 1, 2].map((i) => dominant(data, i * band, (i + 1) * band, 4))
    } catch {
      return FALLBACK_GRADIENT
    }
  })()
  cache.set(src, p)
  return p
}

export function toCss([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`
}

/** Darken slightly so white text keeps contrast on very light paintings. */
export function tone([r, g, b]: Rgb, factor = 0.82): Rgb {
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)]
}
