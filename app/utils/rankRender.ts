import {
  GRID, GLYPH_H, SUPERSAMPLE, STYLE_SPECS, ICON_PALETTE,
  iconById, tagLayout, shadowFallback, toRankSmallCaps,
  type RankTagState, type TagLayout
} from './rankTag.ts'

export interface GlyphBitmap {
  width: number
  height: number
  pixels: Uint8Array
}

const glyphCache = new Map<string, GlyphBitmap>()

export const clearGlyphCache = () => glyphCache.clear()

export async function ensureFont() {
  if (!document.fonts?.load) return
  const size = GRID * SUPERSAMPLE
  await document.fonts.load(`${size}px Monocraft`).catch(() => [])
}

function rasterise(char: string): GlyphBitmap {
  const cached = glyphCache.get(char)
  if (cached) return cached

  const size = GRID * SUPERSAMPLE
  const font = `${size}px Monocraft, monospace`

  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = font
  const advance = probe.measureText(char).width

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(SUPERSAMPLE, Math.ceil(advance) + size)
  canvas.height = size * 2
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(char, 0, Math.round(size * 0.8))

  const cols = Math.ceil(canvas.width / SUPERSAMPLE)
  const rows = Math.ceil(canvas.height / SUPERSAMPLE)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const pixels = new Uint8Array(cols * rows)

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0
      let count = 0
      const maxY = Math.min((gy + 1) * SUPERSAMPLE, canvas.height)
      const maxX = Math.min((gx + 1) * SUPERSAMPLE, canvas.width)
      for (let y = gy * SUPERSAMPLE; y < maxY; y++) {
        for (let x = gx * SUPERSAMPLE; x < maxX; x++) {
          sum += data[(y * canvas.width + x) * 4 + 3]!
          count++
        }
      }
      pixels[gy * cols + gx] = count && sum / (count * 255) >= 0.5 ? 1 : 0
    }
  }

  const bitmap: GlyphBitmap = {
    width: Math.max(1, Math.round(advance / SUPERSAMPLE)),
    height: rows,
    pixels
  }
  glyphCache.set(char, bitmap)
  return bitmap
}

export interface TextBitmap {
  width: number
  height: number
  pixels: Uint8Array
}

export function textBitmap(label: string, spacing: number, descender = 0): TextBitmap {
  const chars = [...label]
  const glyphs = chars.map(c => ({ c, bmp: rasterise(c) }))

  const baselineRow = Math.round(GRID * 0.8)
  const top = baselineRow - GLYPH_H + descender
  const width = Math.max(
    1,
    glyphs.reduce((acc, g) => acc + g.bmp.width, 0) + Math.max(0, chars.length - 1) * spacing
  )

  const pixels = new Uint8Array(width * GLYPH_H)
  let cursor = 0

  for (const { bmp } of glyphs) {
    const cols = Math.ceil(bmp.pixels.length / bmp.height)
    for (let y = 0; y < GLYPH_H; y++) {
      const src = top + y
      if (src < 0 || src >= bmp.height) continue
      for (let x = 0; x < bmp.width; x++) {
        if (x >= cols) break
        if (!bmp.pixels[src * cols + x]) continue
        const px = cursor + x
        if (px >= 0 && px < width) pixels[y * width + px] = 1
      }
    }
    cursor += bmp.width + spacing
  }

  return { width, height: GLYPH_H, pixels }
}

const trimRows = (bmp: TextBitmap): TextBitmap => {
  const filled: number[] = []
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.pixels[y * bmp.width + x]) { filled.push(y); break }
    }
  }
  if (!filled.length) return bmp

  const first = filled[0]!
  const last = filled[filled.length - 1]!
  const height = last - first + 1
  return {
    width: bmp.width,
    height,
    pixels: bmp.pixels.slice(first * bmp.width, (last + 1) * bmp.width)
  }
}

const scaleBitmap = (bmp: TextBitmap, scale: number): TextBitmap => {
  if (scale === 1) return bmp
  const width = bmp.width * scale
  const height = bmp.height * scale
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = bmp.pixels[Math.floor(y / scale) * bmp.width + Math.floor(x / scale)]!
    }
  }
  return { width, height, pixels }
}

const embolden = (bmp: TextBitmap): TextBitmap => {
  const width = bmp.width + 1
  const pixels = new Uint8Array(width * bmp.height)
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (!bmp.pixels[y * bmp.width + x]) continue
      pixels[y * width + x] = 1
      pixels[y * width + x + 1] = 1
    }
  }
  return { width, height: bmp.height, pixels }
}

const outlineOf = (bmp: TextBitmap, thickness: number): TextBitmap => {
  const pad = thickness
  const width = bmp.width + pad * 2
  const height = bmp.height + pad * 2
  const pixels = new Uint8Array(width * height)

  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      if (!bmp.pixels[y * bmp.width + x]) continue
      for (let dy = -pad; dy <= pad; dy++) {
        for (let dx = -pad; dx <= pad; dx++) {
          pixels[(y + pad + dy) * width + (x + pad + dx)] = 1
        }
      }
    }
  }

  return { width, height, pixels }
}

export interface RenderResult {
  layout: TagLayout
  width: number
  height: number
}

export function drawRankTag(
  canvas: HTMLCanvasElement,
  state: RankTagState,
  customImage?: HTMLImageElement | null
): RenderResult {
  const spec = STYLE_SPECS[state.style]
  const label = state.label.toUpperCase() || ' '
  const raw = spec.smallCaps
    ? trimRows(textBitmap(toRankSmallCaps(label), spec.spacing, 1))
    : textBitmap(label, spec.spacing)
  const weighted = spec.bold ? embolden(raw) : raw
  const body = scaleBitmap(weighted, spec.scale)
  const halo = spec.outline > 0 ? outlineOf(body, spec.outline) : null
  const glyphs = halo ?? body
  const bodyOffset = halo ? spec.outline : 0

  const hasIcon = Boolean(customImage || iconById(state.icon))
  const iconSize = customImage ? 8 * spec.scale : 7 * spec.scale

  const layout = tagLayout({
    textWidth: glyphs.width,
    glyphHeight: glyphs.height,
    iconSize,
    hasIcon,
    iconMode: state.iconMode,
    iconGap: state.iconGap,
    compactIconPad: state.compactIconPad,
    padX: state.padX,
    padY: state.padY,
    border: state.border,
    shadow: state.shadow
  })

  canvas.width = layout.width
  canvas.height = layout.height

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, layout.width, layout.height)

  for (const island of layout.islands) {
    if (state.gradient) {
      const grad = ctx.createLinearGradient(island.x, 0, island.x + island.w, 0)
      grad.addColorStop(0, state.bgStart)
      grad.addColorStop(1, state.bgEnd)
      ctx.fillStyle = grad
    }
    else ctx.fillStyle = state.bgStart

    ctx.fillRect(island.x, island.y, island.w, island.h)

    if (state.border > 0) {
      ctx.fillStyle = state.borderColor
      ctx.fillRect(island.x - state.border, island.y - state.border, island.w + 2 * state.border, state.border)
      ctx.fillRect(island.x - state.border, island.y + island.h, island.w + 2 * state.border, state.border)
      ctx.fillRect(island.x - state.border, island.y, state.border, island.h)
      ctx.fillRect(island.x + island.w, island.y, state.border, island.h)
    }
  }

  if (layout.icon) {
    if (customImage) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(customImage, layout.icon.x, layout.icon.y, layout.icon.w, layout.icon.h)
    }
    else {
      const icon = iconById(state.icon)!
      const scale = spec.scale
      for (let y = 0; y < icon.rows.length; y++) {
        const row = icon.rows[y]!
        for (let x = 0; x < row.length; x++) {
          const colour = ICON_PALETTE[row[x]!]
          if (!colour) continue
          ctx.fillStyle = colour
          ctx.fillRect(layout.icon.x + x * scale, layout.icon.y + y * scale, scale, scale)
        }
      }
    }
  }

  const paint = (bmp: TextBitmap, dx: number, dy: number, colour: string) => {
    ctx.fillStyle = colour
    for (let y = 0; y < bmp.height; y++) {
      for (let x = 0; x < bmp.width; x++) {
        if (bmp.pixels[y * bmp.width + x]) {
          ctx.fillRect(layout.text.x + x + dx, layout.text.y + y + dy, 1, 1)
        }
      }
    }
  }

  const shade = state.shadowColor || shadowFallback(state.textColor)
  if (state.shadow > 0) paint(glyphs, state.shadow, state.shadow, shade)
  if (halo) paint(halo, 0, 0, state.outlineColor || shade)
  paint(body, bodyOffset, bodyOffset, state.textColor)

  return { layout, width: layout.width, height: layout.height }
}

export function scaledDataUrl(source: HTMLCanvasElement, scale: number): string {
  if (scale === 1) return source.toDataURL('image/png')

  const out = document.createElement('canvas')
  out.width = source.width * scale
  out.height = source.height * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}
