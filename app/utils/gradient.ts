export type GradientFormat = 'minimessage' | 'amp' | 'section'

export interface GradientStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  obfuscated?: boolean
}

export interface GradientChar {
  char: string
  hex: string
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))

export const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const n = Number.parseInt(full, 16)
  return { r: (n >> 16) & 0xFF, g: (n >> 8) & 0xFF, b: n & 0xFF }
}

export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('').toUpperCase()

export function mix(a: string, b: string, t: number) {
  const c1 = hexToRgb(a)
  const c2 = hexToRgb(b)
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  )
}

export function sample(stops: string[], t: number): string {
  if (stops.length === 0) return '#FFFFFF'
  if (stops.length === 1) return stops[0]!.toUpperCase()

  const span = stops.length - 1
  const pos = Math.max(0, Math.min(1, t)) * span
  const i = Math.min(Math.floor(pos), span - 1)
  return mix(stops[i]!, stops[i + 1]!, pos - i)
}

export function gradientChars(text: string, stops: string[]): GradientChar[] {
  const chars = Array.from(text)
  const visible = chars.filter(c => c !== ' ').length
  if (!visible) return chars.map(char => ({ char, hex: '' }))

  let seen = 0
  return chars.map((char) => {
    if (char === ' ') return { char, hex: '' }
    const t = visible === 1 ? 0 : seen / (visible - 1)
    seen++
    return { char, hex: sample(stops, t) }
  })
}

const STYLE_CODES: [keyof GradientStyle, string, string][] = [
  ['bold', 'l', 'bold'],
  ['italic', 'o', 'italic'],
  ['underline', 'n', 'underlined'],
  ['strike', 'm', 'strikethrough'],
  ['obfuscated', 'k', 'obfuscated']
]

const sectionHex = (hex: string, symbol: string) =>
  symbol + 'x' + Array.from(hex.replace('#', '').toLowerCase()).map(c => symbol + c).join('')

export function toGradientCode(
  text: string,
  stops: string[],
  format: GradientFormat,
  style: GradientStyle = {}
): string {
  if (!text) return ''

  if (format === 'minimessage') {
    const tags = STYLE_CODES.filter(([key]) => style[key]).map(([, , tag]) => tag)
    const open = tags.map(tag => `<${tag}>`).join('')
    const close = [...tags].reverse().map(tag => `</${tag}>`).join('')
    const ramp = stops.map(s => s.toLowerCase()).join(':')
    return `<gradient:${ramp}>${open}${text}${close}</gradient>`
  }

  const symbol = format === 'amp' ? '&' : '§'
  const styleCodes = STYLE_CODES
    .filter(([key]) => style[key])
    .map(([, code]) => symbol + code)
    .join('')

  return gradientChars(text, stops).map(({ char, hex }) => {
    if (!hex) return char
    const color = format === 'amp' ? '&' + hex.toLowerCase() : sectionHex(hex, symbol)
    return color + styleCodes + char
  }).join('')
}

export const GRADIENT_PRESETS: { key: string, stops: string[] }[] = [
  { key: 'sunset', stops: ['#FF9966', '#FF5E62', '#B721FF'] },
  { key: 'ocean', stops: ['#00E0FF', '#0077FF', '#1A2980'] },
  { key: 'rainbow', stops: ['#FF0000', '#FFAA00', '#55FF55', '#00E0FF', '#B721FF'] },
  { key: 'lime', stops: ['#D4FC79', '#96E6A1'] },
  { key: 'fire', stops: ['#FFF200', '#FF7A00', '#D00000'] },
  { key: 'ice', stops: ['#E0FBFC', '#7FD8F7', '#3D5A80'] },
  { key: 'nether', stops: ['#FF4E50', '#7B1FA2'] },
  { key: 'gold', stops: ['#FFF6B7', '#F6416C'] }
]
