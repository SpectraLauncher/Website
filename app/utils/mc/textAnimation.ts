import { sample } from './gradient.ts'

export type AnimStyle = 'left' | 'right' | 'bounce' | 'cycle'

export type AnimFormat =
  | 'minimessage'
  | 'amp_hex'
  | 'angle_hex'
  | 'section_x'
  | 'amp_x'
  | 'json'
  | 'bbcode'

export interface AnimStyleFlags {
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
}

export interface AnimOptions {
  text: string
  stops: string[]
  style: AnimStyle
  format: AnimFormat
  flags?: AnimStyleFlags
}

const FORMAT_CODES: [keyof AnimStyleFlags, string, string, string][] = [
  ['bold', 'l', 'bold', 'B'],
  ['italic', 'o', 'italic', 'I'],
  ['underlined', 'n', 'underlined', 'U'],
  ['strikethrough', 'm', 'strikethrough', 'S'],
  ['obfuscated', 'k', 'obfuscated', '']
]

const activeCodes = (flags: AnimStyleFlags = {}) => FORMAT_CODES.filter(([key]) => flags[key])

export function colorSequence(stops: string[], length: number): string[] {
  const n = Math.max(1, length)
  const ramp = Array.from({ length: n }, (_, i) => sample(stops, n === 1 ? 0 : i / (n - 1)))

  if (n < 3) return ramp
  return [...ramp, ...ramp.slice(1, -1).reverse()]
}

export interface AnimFrame {
  chars: { char: string, hex: string }[]
}

export function buildFrames(opts: AnimOptions): AnimFrame[] {
  const chars = Array.from(opts.text)
  const visible = chars.filter(c => c !== ' ').length
  if (!visible) return []

  const seq = colorSequence(opts.stops, visible)
  const len = seq.length

  const frameAt = (k: number): AnimFrame => {
    let seen = 0
    return {
      chars: chars.map((char) => {
        if (char === ' ') return { char, hex: '' }

        const j = seen++
        const index = opts.style === 'cycle'
          ? k
          : opts.style === 'right'
            ? j + k
            : j - k

        return { char, hex: seq[((index % len) + len) % len]! }
      })
    }
  }

  const forward = Array.from({ length: len }, (_, k) => frameAt(k))
  if (opts.style !== 'bounce' || forward.length < 3) return forward

  return [...forward, ...forward.slice(1, -1).reverse()]
}

const hexDigits = (hex: string) => hex.replace('#', '').toLowerCase()

const perChar = (frame: AnimFrame, render: (hex: string, char: string) => string) =>
  frame.chars.map(c => (c.hex ? render(c.hex, c.char) : c.char)).join('')

export function frameToText(frame: AnimFrame, format: AnimFormat, flags: AnimStyleFlags = {}): string {
  const codes = activeCodes(flags)

  const legacy = (symbol: string) => codes.map(([, code]) => symbol + code).join('')

  const wrap = (body: string, open: (tag: string) => string, close: (tag: string) => string, tagAt: number) => {
    const tags = codes.map(c => c[tagAt] as string).filter(Boolean)
    return tags.map(open).join('') + body + [...tags].reverse().map(close).join('')
  }

  switch (format) {
    case 'minimessage':
      return wrap(
        perChar(frame, (hex, char) => `<color:${hex.toLowerCase()}>${char}`),
        t => `<${t}>`, t => `</${t}>`, 2
      )
    case 'angle_hex':
      return wrap(
        perChar(frame, (hex, char) => `<${hex.toLowerCase()}>${char}`),
        t => `<${t}>`, t => `</${t}>`, 2
      )
    case 'bbcode':
      return wrap(
        perChar(frame, (hex, char) => `[COLOR=${hex.toLowerCase()}]${char}[/COLOR]`),
        t => `[${t}]`, t => `[/${t}]`, 3
      )
    case 'amp_hex':
      return perChar(frame, (hex, char) => `&${hex.toLowerCase()}${legacy('&')}${char}`)
    case 'section_x':
      return perChar(frame, (hex, char) =>
        '§x' + Array.from(hexDigits(hex)).map(d => '§' + d).join('') + legacy('§') + char)
    case 'amp_x':
      return perChar(frame, (hex, char) =>
        '&x' + Array.from(hexDigits(hex)).map(d => '&' + d).join('') + legacy('&') + char)
    case 'json':
      return JSON.stringify(frame.chars.map((c) => {
        const node: Record<string, unknown> = { text: c.char }
        if (c.hex) node.color = c.hex.toLowerCase()
        for (const [key] of codes) node[key] = true
        return node
      }))
  }
}

export const DEFAULT_TEMPLATE = `%name%:
  change-interval: %speed%
  texts:
%output:{  - "$t"}%`

export function renderTemplate(
  template: string,
  frames: string[],
  name: string,
  speed: number
): string {
  return template
    .replace(/%output:\{([\s\S]*?)\}%/g, (_, body: string) =>
      frames.map(f => body.replace(/\$t/g, f)).join('\n'))
    .replace(/%name%/g, name)
    .replace(/%speed%/g, String(speed))
}

export const FORMAT_LABEL: Record<AnimFormat, string> = {
  amp_hex: '&#rrggbb',
  minimessage: 'MiniMessage',
  angle_hex: '<#rrggbb>',
  section_x: '§x§r§r§g§g§b§b',
  amp_x: '&x&r&r&g&g&b&b',
  json: 'JSON',
  bbcode: '[COLOR=#rrggbb]'
}

export const ANIM_FORMATS: AnimFormat[] = [
  'amp_hex', 'minimessage', 'angle_hex', 'section_x', 'amp_x', 'json', 'bbcode'
]

export const frameCount = (opts: AnimOptions) => buildFrames(opts).length

export const ANIM_STYLES: AnimStyle[] = ['left', 'right', 'bounce', 'cycle']
