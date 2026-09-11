import { segmentToJson, type TellrawSegment } from './tellraw.ts'
import { fromHex } from './rgb.ts'
import type { Vec3 } from './coords.ts'

export type DisplayKind = 'text' | 'block' | 'item'
export type DisplayVersion = 'modern' | 'legacy'
export type Billboard = 'fixed' | 'vertical' | 'horizontal' | 'center'
export type TextAlign = 'center' | 'left' | 'right'
export type ItemContext =
  | 'none'
  | 'thirdperson_lefthand'
  | 'thirdperson_righthand'
  | 'firstperson_lefthand'
  | 'firstperson_righthand'
  | 'head'
  | 'gui'
  | 'ground'
  | 'fixed'

export const DISPLAY_KINDS: DisplayKind[] = ['text', 'block', 'item']
export const BILLBOARDS: Billboard[] = ['fixed', 'vertical', 'horizontal', 'center']
export const TEXT_ALIGNS: TextAlign[] = ['center', 'left', 'right']
export const ITEM_CONTEXTS: ItemContext[] = [
  'none', 'thirdperson_lefthand', 'thirdperson_righthand',
  'firstperson_lefthand', 'firstperson_righthand',
  'head', 'gui', 'ground', 'fixed'
]

export interface Euler { yaw: number, pitch: number, roll: number }
export type Quat = [number, number, number, number]
export interface BlockProperty { key: string, value: string }

export interface DisplayState {
  kind: DisplayKind
  version: DisplayVersion
  pos: { x: string, y: string, z: string }
  segments: TellrawSegment[]
  lineWidth: number
  textOpacity: number
  bgColor: string
  bgAlpha: number
  defaultBackground: boolean
  shadow: boolean
  seeThrough: boolean
  align: TextAlign
  blockId: string
  blockProps: BlockProperty[]
  itemId: string
  itemContext: ItemContext
  translation: Vec3
  scale: Vec3
  left: Euler
  right: Euler
  billboard: Billboard
  brightnessOverride: boolean
  blockLight: number
  skyLight: number
  viewRange: number
  shadowRadius: number
  shadowStrength: number
  glowing: boolean
  glowOverride: boolean
  glowColor: string
  interpolationDuration: number
  startInterpolation: number
  teleportDuration: number
}

export const MAX_CHAT = 256
export const MIN_SCALE = 0.05
export const MAX_SCALE = 8
export const DEFAULT_LINE_WIDTH = 200
export const DEFAULT_BACKGROUND = 0x40000000 | 0
export const MIN_VISIBLE_OPACITY = 26

export const IDENTITY: Euler = { yaw: 0, pitch: 0, roll: 0 }

const RAD = Math.PI / 180

export function quatFromEuler(e: Euler): Quat {
  const cy = Math.cos(e.yaw * RAD / 2)
  const sy = Math.sin(e.yaw * RAD / 2)
  const cp = Math.cos(e.pitch * RAD / 2)
  const sp = Math.sin(e.pitch * RAD / 2)
  const cr = Math.cos(e.roll * RAD / 2)
  const sr = Math.sin(e.roll * RAD / 2)

  return [
    sp * cy * cr + cp * sy * sr,
    cp * sy * cr - sp * cy * sr,
    cp * cy * sr - sp * sy * cr,
    cp * cy * cr + sp * sy * sr
  ]
}

const num = (v: number) => String(Number((v || 0).toFixed(5)))

const flt = (v: number) => num(v) + 'f'

const byte = (v: number) => (((Math.round(v) & 0xFF) << 24) >> 24) + 'b'

export const argbInt = (hex: string, alpha: number) =>
  (((Math.round(alpha) & 0xFF) << 24) | fromHex(hex)) | 0

export const namespaced = (id: string) => {
  const clean = id.trim().toLowerCase().replace(/^\/+/, '')
  if (!clean) return ''
  return clean.includes(':') ? clean : `minecraft:${clean}`
}

const quoted = (v: string) => JSON.stringify(v)

const singleQuoted = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const BARE_KEY = /^[A-Za-z0-9_.+-]+$/

function toSnbt(value: unknown): string {
  if (typeof value === 'string') return quoted(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return num(value)
  if (Array.isArray(value)) return `[${value.map(toSnbt).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
  return `{${entries.map(([k, v]) => `${BARE_KEY.test(k) ? k : quoted(k)}:${toSnbt(v)}`).join(',')}}`
}

export function textComponent(segments: TellrawSegment[], version: DisplayVersion): string {
  const parts = segments.filter(s => s.text).map(s => segmentToJson(s, 'modern'))
  const value = parts.length === 0 ? '' : parts.length === 1 ? parts[0]! : ['', ...parts]

  return version === 'legacy' ? singleQuoted(JSON.stringify(value)) : toSnbt(value)
}

const sameEuler = (e: Euler) => e.yaw === 0 && e.pitch === 0 && e.roll === 0

const defaultTransform = (s: DisplayState) =>
  s.translation.x === 0 && s.translation.y === 0 && s.translation.z === 0
  && s.scale.x === 1 && s.scale.y === 1 && s.scale.z === 1
  && sameEuler(s.left) && sameEuler(s.right)

export function transformationNbt(s: DisplayState): string {
  const l = quatFromEuler(s.left)
  const r = quatFromEuler(s.right)
  const t = s.translation
  const sc = s.scale

  return '{'
    + `left_rotation:[${l.map(flt).join(',')}],`
    + `right_rotation:[${r.map(flt).join(',')}],`
    + `translation:[${flt(t.x)},${flt(t.y)},${flt(t.z)}],`
    + `scale:[${flt(sc.x)},${flt(sc.y)},${flt(sc.z)}]`
    + '}'
}

export function displayNbt(s: DisplayState): string {
  const parts: string[] = []
  const put = (key: string, value: string) => parts.push(`${key}:${value}`)

  if (s.kind === 'text') {
    put('text', textComponent(s.segments, s.version))

    if (s.defaultBackground) put('default_background', '1b')
    else {
      const bg = argbInt(s.bgColor, s.bgAlpha)
      if (bg !== DEFAULT_BACKGROUND) put('background', String(bg))
    }

    if (Math.round(s.lineWidth) !== DEFAULT_LINE_WIDTH) put('line_width', String(Math.round(s.lineWidth)))
    if (Math.round(s.textOpacity) !== 255) put('text_opacity', byte(s.textOpacity))
    if (s.align !== 'center') put('alignment', quoted(s.align))
    if (s.shadow) put('shadow', '1b')
    if (s.seeThrough) put('see_through', '1b')
  }

  if (s.kind === 'block') {
    const props = s.blockProps.filter(p => p.key.trim() && p.value.trim())
    const inner = [`Name:${quoted(namespaced(s.blockId) || 'minecraft:stone')}`]
    if (props.length) {
      inner.push(`Properties:{${props.map(p => `${p.key.trim()}:${quoted(p.value.trim())}`).join(',')}}`)
    }
    put('block_state', `{${inner.join(',')}}`)
  }

  if (s.kind === 'item') {
    const id = quoted(namespaced(s.itemId) || 'minecraft:stone')
    put('item', s.version === 'modern' ? `{id:${id},count:1}` : `{id:${id},Count:1b}`)
    if (s.itemContext !== 'none') put('item_display', quoted(s.itemContext))
  }

  if (!defaultTransform(s)) put('transformation', transformationNbt(s))

  if (s.billboard !== 'fixed') put('billboard', quoted(s.billboard))
  if (s.brightnessOverride) put('brightness', `{block:${Math.round(s.blockLight)},sky:${Math.round(s.skyLight)}}`)
  if (s.viewRange !== 1) put('view_range', flt(s.viewRange))
  if (s.shadowRadius !== 0) put('shadow_radius', flt(s.shadowRadius))
  if (s.shadowStrength !== 1) put('shadow_strength', flt(s.shadowStrength))
  if (s.glowing) put('Glowing', '1b')
  if (s.glowOverride) put('glow_color_override', String(fromHex(s.glowColor)))
  if (s.interpolationDuration > 0) put('interpolation_duration', String(Math.round(s.interpolationDuration)))
  if (s.startInterpolation > 0) put('start_interpolation', String(Math.round(s.startInterpolation)))
  if (s.teleportDuration > 0) put('teleport_duration', String(Math.round(s.teleportDuration)))

  return `{${parts.join(',')}}`
}

const coord = (v: string) => (v.trim() || '~')

export function displayCommand(s: DisplayState): string {
  const pos = `${coord(s.pos.x)} ${coord(s.pos.y)} ${coord(s.pos.z)}`
  return `/summon minecraft:${s.kind}_display ${pos} ${displayNbt(s)}`
}

export const killCommand = (kind: DisplayKind) => `/kill @e[type=minecraft:${kind}_display,distance=..5]`

export function defaultDisplay(): DisplayState {
  return {
    kind: 'text',
    version: 'modern',
    pos: { x: '~', y: '~1', z: '~' },
    segments: [],
    lineWidth: DEFAULT_LINE_WIDTH,
    textOpacity: 255,
    bgColor: '#000000',
    bgAlpha: 64,
    defaultBackground: false,
    shadow: false,
    seeThrough: false,
    align: 'center',
    blockId: 'diamond_block',
    blockProps: [],
    itemId: 'diamond_sword',
    itemContext: 'none',
    translation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    left: { ...IDENTITY },
    right: { ...IDENTITY },
    billboard: 'fixed',
    brightnessOverride: false,
    blockLight: 15,
    skyLight: 15,
    viewRange: 1,
    shadowRadius: 0,
    shadowStrength: 1,
    glowing: false,
    glowOverride: false,
    glowColor: '#FF3030',
    interpolationDuration: 0,
    startInterpolation: 0,
    teleportDuration: 0
  }
}

export interface DisplayPreset {
  key: string
  patch: (base: DisplayState) => DisplayState
}

const seg = (text: string, over: Partial<TellrawSegment> = {}): TellrawSegment => ({
  text,
  color: 'white',
  bold: false,
  italic: false,
  underlined: false,
  strikethrough: false,
  obfuscated: false,
  clickAction: 'none',
  clickValue: '',
  hoverText: '',
  ...over
})

export const DISPLAY_PRESETS: DisplayPreset[] = [
  {
    key: 'hologram',
    patch: b => ({
      ...b,
      kind: 'text',
      pos: { x: '~', y: '~2', z: '~' },
      segments: [seg('Server Hub')],
      bgAlpha: 0,
      shadow: true,
      billboard: 'center',
      scale: { x: 0.8, y: 0.8, z: 0.8 }
    })
  },
  {
    key: 'shop',
    patch: b => ({
      ...b,
      kind: 'text',
      pos: { x: '~', y: '~1.2', z: '~' },
      segments: [seg('SHOP', { color: 'yellow', bold: true }), seg('\nBuy & sell here', { color: 'gray' })],
      bgColor: '#100E1E',
      bgAlpha: 200,
      billboard: 'center'
    })
  },
  {
    key: 'billboard',
    patch: b => ({
      ...b,
      kind: 'text',
      pos: { x: '~', y: '~3', z: '~' },
      segments: [seg('WELCOME', { color: 'aqua', bold: true }), seg('\nto spawn')],
      lineWidth: 120,
      scale: { x: 4, y: 4, z: 4 }
    })
  },
  {
    key: 'warning',
    patch: b => ({
      ...b,
      kind: 'text',
      segments: [seg('! WARNING !', { color: 'red', bold: true })],
      bgColor: '#2A0000',
      bgAlpha: 140,
      shadow: true,
      seeThrough: true,
      billboard: 'center',
      glowing: true,
      glowOverride: true,
      glowColor: '#FF3030'
    })
  },
  {
    key: 'block',
    patch: b => ({
      ...b,
      kind: 'block',
      blockId: 'diamond_block',
      translation: { x: -0.5, y: 0.4, z: -0.5 },
      left: { yaw: 45, pitch: 0, roll: 0 },
      interpolationDuration: 40
    })
  },
  {
    key: 'item',
    patch: b => ({
      ...b,
      kind: 'item',
      itemId: 'diamond_sword',
      itemContext: 'ground',
      translation: { x: 0, y: 0.5, z: 0 },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
      left: { yaw: 0, pitch: 0, roll: 45 }
    })
  }
]
