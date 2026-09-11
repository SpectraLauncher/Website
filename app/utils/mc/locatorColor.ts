import { type Rgb, toRgb } from './rgb.ts'

const f = Math.fround

export const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

export const isUuid = (value: string) => UUID_RE.test(value.trim())

export const dashUuid = (value: string) => {
  const h = value.replace(/-/g, '').toLowerCase()
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function uuidHash(uuid: string): number {
  const hex = uuid.replace(/-/g, '')
  const hilo = BigInt('0x' + hex.slice(0, 16)) ^ BigInt('0x' + hex.slice(16, 32))
  const hi = BigInt.asIntN(32, hilo >> 32n)
  const lo = BigInt.asIntN(32, hilo & 0xFFFFFFFFn)
  return Number(BigInt.asIntN(32, hi ^ lo))
}

export const rawColor = (uuid: string) => uuidHash(uuid) & 0xFFFFFF

export function rgbToHsb({ r, g, b }: Rgb): [number, number, number] {
  const cmax = Math.max(r, g, b)
  const cmin = Math.min(r, g, b)
  const brightness = f(cmax / 255)
  const saturation = cmax !== 0 ? f((cmax - cmin) / cmax) : 0

  if (saturation === 0) return [0, 0, brightness]

  const d = cmax - cmin
  const redc = f((cmax - r) / d)
  const greenc = f((cmax - g) / d)
  const bluec = f((cmax - b) / d)

  let hue: number
  if (r === cmax) hue = f(bluec - greenc)
  else if (g === cmax) hue = f(f(2) + f(redc - bluec))
  else hue = f(f(4) + f(greenc - redc))

  hue = f(hue / 6)
  if (hue < 0) hue = f(hue + 1)

  return [hue, saturation, brightness]
}

export function hsbToRgb(h: number, s: number, v: number): number {
  const q8 = (x: number) => Math.trunc(f(f(x * 255) + 0.5))

  if (s === 0) {
    const c = q8(v)
    return (c << 16) | (c << 8) | c
  }

  const h6 = f(f(h - Math.floor(h)) * 6)
  const frac = f(h6 - Math.floor(h6))
  const p = f(v * f(1 - s))
  const q = f(v * f(1 - f(s * frac)))
  const t = f(v * f(1 - f(s * f(1 - frac))))

  const table: [number, number, number][] = [
    [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]
  ]
  const [r, g, b] = table[Math.trunc(h6)]!
  return (q8(r) << 16) | (q8(g) << 8) | q8(b)
}

export const setBrightness = (color: number, brightness = 0.9) => {
  const [h, s] = rgbToHsb(toRgb(color))
  return hsbToRgb(h, s, f(brightness))
}

export const locatorColor = (uuid: string) => setBrightness(rawColor(uuid))

export const locatorColorLegacy = (uuid: string) => {
  const { r, g, b } = toRgb(rawColor(uuid))
  const scale = (c: number) => Math.trunc(f(c * 0.9))
  return (scale(r) << 16) | (scale(g) << 8) | scale(b)
}
