export type SkinModel = 'classic' | 'slim'
export type SkinAnimation = 'none' | 'walk' | 'crouch'
export type CapeSource = 'minecraft' | 'optifine' | 'labymod' | 'minecraftcapes'

export const CAPE_SOURCES: CapeSource[] = ['minecraft', 'optifine', 'labymod', 'minecraftcapes']

export const MOD_CAPE_SOURCES = CAPE_SOURCES.filter(s => s !== 'minecraft')

export const modCapeUrl = (source: CapeSource, name: string, uuid: string) =>
  `/api/mc-cape?source=${encodeURIComponent(source)}&name=${encodeURIComponent(name)}&uuid=${encodeURIComponent(uuid)}`

export interface SkinProfile {
  uuid: string
  name: string
  skin: string | null
  model: SkinModel
  cape: string | null
}

export interface CapeEntry {
  key: string
  source: CapeSource
  url: string
  name?: string
  equipped?: boolean
}

export interface OwnedCape {
  slug: string
  name: string
  hash: string
}

export const capeTextureUrl = (hash: string) => `https://textures.minecraft.net/texture/${hash}`

export const isEquipped = (hash: string, activeUrl: string | null) =>
  Boolean(activeUrl && activeUrl.endsWith(hash))

export interface UvRect { x: number, y: number, w: number, h: number, flipV?: boolean }

export interface PartSpec {
  id: string
  size: [number, number, number]
  position: [number, number, number]
  uv: [number, number]
  overlayUv: [number, number] | null
  slimWidth?: number
}

export const SKIN_SIZE = 64

export const PARTS: PartSpec[] = [
  { id: 'head', size: [8, 8, 8], position: [0, 28, 0], uv: [0, 0], overlayUv: [32, 0] },
  { id: 'body', size: [8, 12, 4], position: [0, 18, 0], uv: [16, 16], overlayUv: [16, 32] },
  { id: 'rightArm', size: [4, 12, 4], position: [-6, 18, 0], uv: [40, 16], overlayUv: [40, 32], slimWidth: 3 },
  { id: 'leftArm', size: [4, 12, 4], position: [6, 18, 0], uv: [32, 48], overlayUv: [48, 48], slimWidth: 3 },
  { id: 'rightLeg', size: [4, 12, 4], position: [-2, 6, 0], uv: [0, 16], overlayUv: [0, 32] },
  { id: 'leftLeg', size: [4, 12, 4], position: [2, 6, 0], uv: [16, 48], overlayUv: [0, 48] }
]

export const OVERLAY_INFLATE = 0.5

export function partGeometry(part: PartSpec, model: SkinModel) {
  const width = model === 'slim' && part.slimWidth ? part.slimWidth : part.size[0]
  const shift = part.size[0] - width
  const [x, y, z] = part.position

  return {
    size: [width, part.size[1], part.size[2]] as [number, number, number],
    position: [
      part.id === 'rightArm' ? x + shift / 2 : part.id === 'leftArm' ? x - shift / 2 : x,
      y,
      z
    ] as [number, number, number]
  }
}

export function boxFaces(u: number, v: number, w: number, h: number, d: number): UvRect[] {
  return [
    { x: u + d + w, y: v + d, w: d, h },
    { x: u, y: v + d, w: d, h },
    { x: u + d, y: v, w, h: d },
    { x: u + d + w, y: v, w, h: d, flipV: true },
    { x: u + d, y: v + d, w, h },
    { x: u + 2 * d + w, y: v + d, w, h }
  ]
}

export function limbFaces(
  u: number, v: number, w: number, h: number, d: number,
  fromTop: number, segment: number
): UvRect[] {
  const y = v + d + fromTop
  const cross: UvRect = { x: u + d, y: v, w, h: d }
  const isTop = fromTop === 0
  const isBottom = fromTop + segment >= h

  return [
    { x: u + d + w, y, w: d, h: segment },
    { x: u, y, w: d, h: segment },
    isTop ? cross : { ...cross },
    isBottom ? { x: u + d + w, y: v, w, h: d, flipV: true } : { ...cross },
    { x: u + d, y, w, h: segment },
    { x: u + 2 * d + w, y, w, h: segment }
  ]
}

export const CAPE_RECT: UvRect = {
  x: 1,
  y: 1,
  w: 10,
  h: 16,
}

export const CAPE_LAYOUTS: Array<[number, number]> = [
  [64, 32],
  [46, 22],
  [22, 17],
]

export function capeScale(width: number, height: number): number {
  for (const [bw, bh] of CAPE_LAYOUTS) {
    if (width % bw || height % bh) continue
    if (width / bw === height / bh) return width / bw
  }
  return Math.max(1, Math.round(width / 64)) || 1
}

export const capeFaces = (scale = 1): UvRect[] => ([
  { x: 11, y: 1, w: 1, h: 16 },
  { x: 0, y: 1, w: 1, h: 16 },
  { x: 1, y: 0, w: 10, h: 1 },
  { x: 11, y: 0, w: 10, h: 1, flipV: true },
  { x: 12, y: 1, w: 10, h: 16 },
  { x: 1, y: 1, w: 10, h: 16 }
] as UvRect[]).map(r => ({ ...r, x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale }))

export const isLegacySkin = (width: number, height: number) => width === 64 && height === 32

export interface LegacyCopy { from: UvRect, to: [number, number] }

export const LEGACY_COPIES: LegacyCopy[] = [
  { from: { x: 4, y: 16, w: 4, h: 4 }, to: [20, 48] },
  { from: { x: 8, y: 16, w: 4, h: 4 }, to: [24, 48] },
  { from: { x: 0, y: 20, w: 4, h: 12 }, to: [24, 52] },
  { from: { x: 4, y: 20, w: 4, h: 12 }, to: [20, 52] },
  { from: { x: 8, y: 20, w: 4, h: 12 }, to: [16, 52] },
  { from: { x: 12, y: 20, w: 4, h: 12 }, to: [28, 52] },
  { from: { x: 44, y: 16, w: 4, h: 4 }, to: [36, 48] },
  { from: { x: 48, y: 16, w: 4, h: 4 }, to: [40, 48] },
  { from: { x: 40, y: 20, w: 4, h: 12 }, to: [40, 52] },
  { from: { x: 44, y: 20, w: 4, h: 12 }, to: [36, 52] },
  { from: { x: 48, y: 20, w: 4, h: 12 }, to: [32, 52] },
  { from: { x: 52, y: 20, w: 4, h: 12 }, to: [44, 52] }
]

export const LEGACY_HAT: UvRect = {
  x: 32,
  y: 0,
  w: 32,
  h: 16,
}

export function stripLegacyHat(data: Uint8ClampedArray, width: number): boolean {
  const { x, y, w, h } = LEGACY_HAT

  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (data[(py * width + px) * 4 + 3]! < 128) return false
    }
  }

  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      data[(py * width + px) * 4 + 3] = 0
    }
  }

  return true
}

export const HEAD_CROP: UvRect = {
  x: 8,
  y: 8,
  w: 8,
  h: 8,
}
export const HEAD_OVERLAY_CROP: UvRect = {
  x: 40,
  y: 8,
  w: 8,
  h: 8,
}

export const normaliseQuery = (input: string) => {
  const trimmed = input.trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed)
    ? trimmed.replace(/-/g, '')
    : trimmed
}

export const skinFileName = (name: string, suffix: string) =>
  `${name.replace(/[^A-Za-z0-9_-]/g, '') || 'skin'}-${suffix}.png`
