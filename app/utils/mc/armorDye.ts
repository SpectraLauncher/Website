import { type Rgb, toRgb, toInt, fromHex } from './rgb.ts'
import { BANNER_COLORS } from './bannerPatterns.ts'

export interface Dye {
  id: string
  hex: string
  file: string
}

export const DYES: Dye[] = BANNER_COLORS.map(c => ({
  id: c.id,
  hex: c.hex,
  file: c.id.split('_').map(p => p[0]!.toUpperCase() + p.slice(1)).join('_')
}))

const DYE_BY_ID = new Map(DYES.map(d => [d.id, d]))
export const dyeById = (id: string) => DYE_BY_ID.get(id)

export const UNDYED = 0xA06540

export function mixDyes(dyes: string[], armorColor?: number): number | undefined {
  const inputs: Rgb[] = []

  if (armorColor !== undefined) inputs.push(toRgb(armorColor))
  for (const id of dyes) {
    const dye = DYE_BY_ID.get(id)
    if (dye) inputs.push(toRgb(fromHex(dye.hex)))
  }
  if (!inputs.length) return undefined

  let sumR = 0, sumG = 0, sumB = 0, sumMax = 0
  for (const c of inputs) {
    sumR += c.r
    sumG += c.g
    sumB += c.b
    sumMax += Math.max(c.r, c.g, c.b)
  }

  const n = inputs.length
  const avgR = Math.floor(sumR / n)
  const avgG = Math.floor(sumG / n)
  const avgB = Math.floor(sumB / n)
  const avgMax = sumMax / n
  const maxOfAvg = Math.max(avgR, avgG, avgB)
  if (maxOfAvg === 0) return 0

  const gain = avgMax / maxOfAvg
  return toInt({
    r: Math.floor(avgR * gain),
    g: Math.floor(avgG * gain),
    b: Math.floor(avgB * gain)
  })
}

export const distance = (a: Rgb, b: Rgb) => {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return dr * dr + dg * dg + db * db
}

export interface DyeMatch {
  dyes: string[]
  color: number
  distance: number
}

export function matchColor(target: number, maxDyes = 8): DyeMatch {
  const want = toRgb(target)
  const palette = DYES.map(d => toRgb(fromHex(d.hex)))

  let best: DyeMatch = { dyes: [], color: 0, distance: Infinity }
  const picked: number[] = []

  const evaluate = (sumR: number, sumG: number, sumB: number, sumMax: number, n: number) => {
    const avgR = Math.floor(sumR / n)
    const avgG = Math.floor(sumG / n)
    const avgB = Math.floor(sumB / n)
    const maxOfAvg = Math.max(avgR, avgG, avgB)
    if (maxOfAvg === 0) return

    const gain = (sumMax / n) / maxOfAvg
    const color = {
      r: Math.floor(avgR * gain),
      g: Math.floor(avgG * gain),
      b: Math.floor(avgB * gain)
    }

    const d = distance(color, want)
    if (d < best.distance) {
      best = { dyes: picked.map(i => DYES[i]!.id), color: toInt(color), distance: d }
    }
  }

  const walk = (start: number, sumR: number, sumG: number, sumB: number, sumMax: number, n: number) => {
    if (n > 0) evaluate(sumR, sumG, sumB, sumMax, n)
    if (n === maxDyes) return

    for (let i = start; i < palette.length; i++) {
      const c = palette[i]!
      picked.push(i)
      walk(i, sumR + c.r, sumG + c.g, sumB + c.b, sumMax + Math.max(c.r, c.g, c.b), n + 1)
      picked.pop()
    }
  }

  walk(0, 0, 0, 0, 0, 0)
  return best
}

export type ArmorPiece = 'helmet' | 'chestplate' | 'leggings' | 'boots'

export const ARMOR_PIECES: ArmorPiece[] = ['helmet', 'chestplate', 'leggings', 'boots']

const ITEM_ID: Record<ArmorPiece, string> = {
  helmet: 'leather_helmet',
  chestplate: 'leather_chestplate',
  leggings: 'leather_leggings',
  boots: 'leather_boots'
}

export function dyeCommand(piece: ArmorPiece, color: number, legacy: boolean, target = '@p') {
  const item = ITEM_ID[piece]
  return legacy
    ? `/give ${target} ${item}{display:{color:${color}}} 1`
    : `/give ${target} ${item}[dyed_color=${color}]`
}
