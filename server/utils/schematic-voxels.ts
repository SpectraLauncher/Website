
import {
  type BlockState,
  type SchematicFormat,
  SCHEMATIC_LIMITS,
  parseStateString,
} from './schematic'

export interface VoxelPayload {
  format: SchematicFormat
  size: [number, number, number]
  palette: string[]
  colors: number[]
  // Flat triples of x, y, z followed by a palette index, so the browser can copy
  // it straight into a typed array without walking a million small objects.
  voxels: number[]
  total: number
  shown: number
  truncated: boolean
}

// Above this a browser is not going to give anyone a good time regardless of how
// the geometry is built, so the payload is thinned rather than the frame rate.
const MAX_VOXELS = 400_000

const AIR = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'])

// Registry: block id -> RGB. Only what a builder actually places often enough to
// notice; everything else falls through to the keyword rules below, which is why
// this list can stay short and still look right. Add an entry when a block comes
// out visibly wrong.
const BLOCK_COLORS: Record<string, number> = {
  'minecraft:stone': 0x7D7D7D,
  'minecraft:cobblestone': 0x7A7A7A,
  'minecraft:mossy_cobblestone': 0x6B7A5B,
  'minecraft:stone_bricks': 0x7A7A7A,
  'minecraft:deepslate': 0x4D4D51,
  'minecraft:granite': 0x9A6B5A,
  'minecraft:diorite': 0xBFBFBF,
  'minecraft:andesite': 0x8A8A8A,
  'minecraft:calcite': 0xE0DFDA,
  'minecraft:tuff': 0x6C6E62,
  'minecraft:bricks': 0x96594A,
  'minecraft:dirt': 0x866043,
  'minecraft:coarse_dirt': 0x7A5636,
  'minecraft:rooted_dirt': 0x91674C,
  'minecraft:podzol': 0x5B3F1D,
  'minecraft:grass_block': 0x5E9A3C,
  'minecraft:moss_block': 0x5B7A2E,
  'minecraft:moss_carpet': 0x5B7A2E,
  'minecraft:sand': 0xDBD3A0,
  'minecraft:red_sand': 0xBF6E33,
  'minecraft:gravel': 0x877F7C,
  'minecraft:clay': 0xA0A6B4,
  'minecraft:snow_block': 0xF0F5F5,
  'minecraft:ice': 0xA0B8F0,
  'minecraft:packed_ice': 0x8DAAF2,
  'minecraft:obsidian': 0x14101F,
  'minecraft:netherrack': 0x6D3634,
  'minecraft:end_stone': 0xDDDCA4,
  'minecraft:glowstone': 0xF9D68F,
  'minecraft:sea_lantern': 0xB1C6BC,
  'minecraft:water': 0x3F76E4,
  'minecraft:lava': 0xD45A12,
  'minecraft:glass': 0xC0E4EE,
  'minecraft:iron_bars': 0x9A9A9A,
  'minecraft:chain': 0x3B3F46,
  'minecraft:hay_block': 0xB6A21C,
  'minecraft:bookshelf': 0x9A7B4F,
  'minecraft:crafting_table': 0x976A44,
  'minecraft:barrel': 0x86643A,
  'minecraft:chest': 0x9A7444,
  'minecraft:furnace': 0x767676,
  'minecraft:cauldron': 0x4A4A4A,
  'minecraft:cobweb': 0xDCDCDC,
  'minecraft:vine': 0x3F6B22,
  'minecraft:cave_vines': 0x6F8A2E,
  'minecraft:cave_vines_plant': 0x6F8A2E,
  'minecraft:hanging_roots': 0xB98A6B,
  'minecraft:short_grass': 0x5E9A3C,
  'minecraft:fern': 0x5E9A3C,
  'minecraft:large_fern': 0x5E9A3C,
  'minecraft:dead_bush': 0x8A6A32,
  'minecraft:azalea': 0x5F8B33,
  'minecraft:flowering_azalea': 0x7E9A4A,
  'minecraft:blue_orchid': 0x2FA5C4,
  'minecraft:cornflower': 0x4A66C4,
  'minecraft:brown_mushroom': 0x9A6B4A,
  'minecraft:flower_pot': 0x8B4A32,
}

// Wood tones keyed by the species that appears in the block name. Doors, stairs,
// slabs, fences, logs and planks all inherit from the same entry.
const WOOD_TONES: Record<string, number> = {
  oak: 0xA98A56,
  spruce: 0x6B4F2A,
  birch: 0xC8B77A,
  jungle: 0xA0714A,
  acacia: 0xB05C33,
  dark_oak: 0x4B3421,
  mangrove: 0x8A3A2F,
  cherry: 0xE0AFB4,
  bamboo: 0xC2B04A,
  crimson: 0x8A3A5B,
  warped: 0x2C8C7E,
  pale_oak: 0xD6CDBE,
}

// Dye tones for the sixteen-colour families: wool, concrete, terracotta, glass.
const DYE_TONES: Record<string, number> = {
  white: 0xE9ECEC,
  orange: 0xF07613,
  magenta: 0xBD44B3,
  light_blue: 0x3AAFD9,
  yellow: 0xF8C627,
  lime: 0x70B919,
  pink: 0xED8DAC,
  gray: 0x3E4447,
  light_gray: 0x8E8E86,
  cyan: 0x158991,
  purple: 0x792AAC,
  blue: 0x35399D,
  brown: 0x724728,
  green: 0x546D1B,
  red: 0xA12722,
  black: 0x141519,
}

function keywordColor(id: string): number | null {
  const name = id.replace(/^[a-z0-9_]+:/, '')

  for (const [dye, color] of Object.entries(DYE_TONES)) {
    if (name.startsWith(`${dye}_`)) {
      // Terracotta and concrete powder are muted versions of the same hue.
      if (name.includes('terracotta')) return blend(color, 0x8A6552, 0.55)
      return color
    }
  }

  for (const [species, color] of Object.entries(WOOD_TONES)) {
    if (name.startsWith(`${species}_`) || name.startsWith(`stripped_${species}_`)) {
      return name.includes('stripped') ? blend(color, 0xD9B98A, 0.4) : color
    }
  }

  if (name.includes('leaves')) return 0x3F7A28
  if (name.includes('glass')) return 0xC0E4EE
  if (name.includes('deepslate')) return 0x4D4D51
  if (name.includes('stone')) return 0x7D7D7D
  if (name.includes('planks') || name.includes('wood') || name.includes('log')) return 0xA98A56
  if (name.includes('copper')) return 0xC26E4B
  if (name.includes('iron')) return 0xD8D8D8
  if (name.includes('gold')) return 0xF6DE6C
  if (name.includes('sandstone')) return 0xDBD3A0

  return null
}

function blend(a: number, b: number, weight: number): number {
  const mix = (shift: number) => {
    const left = (a >> shift) & 0xFF
    const right = (b >> shift) & 0xFF
    return Math.round(left * (1 - weight) + right * weight) & 0xFF
  }
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

// A stable fallback so two unknown blocks never share a colour by accident and
// the same unknown block always looks the same.
function hashColor(id: string): number {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hash % 360
  return hslToRgb(hue, 0.35, 0.55)
}

function hslToRgb(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return (Math.round((r! + m) * 255) << 16) | (Math.round((g! + m) * 255) << 8)
    | Math.round((b! + m) * 255)
}

export function blockColor(id: string): number {
  return BLOCK_COLORS[id] ?? keywordColor(id) ?? hashColor(id)
}

export interface VoxelSource {
  format: SchematicFormat
  size: { x: number, y: number, z: number }
  // Palette index per position, laid out y-major then z then x, which is the
  // order all four formats store their blocks in.
  indices: Uint32Array
  palette: BlockState[]
}

// Drops every block that is fully enclosed by other blocks. A solid cube of
// n blocks a side has n^3 blocks and only about 6n^2 visible ones, so on
// anything larger than a hut this is the difference between a usable scene and
// a browser tab that stops responding.
export function voxelize(source: VoxelSource): VoxelPayload {
  const { x: sx, y: sy, z: sz } = source.size
  const { indices, palette } = source

  const solid = palette.map(state => !AIR.has(state.id))
  const at = (x: number, y: number, z: number) => indices[(y * sz + z) * sx + x] ?? 0

  const occupied = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return false
    return solid[at(x, y, z)] ?? false
  }

  const used = new Map<number, number>()
  const voxels: number[] = []
  let total = 0
  let truncated = false

  for (let y = 0; y < sy; y++) {
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        const index = at(x, y, z)
        if (!solid[index]) continue
        total++

        const hidden = occupied(x - 1, y, z) && occupied(x + 1, y, z)
          && occupied(x, y - 1, z) && occupied(x, y + 1, z)
          && occupied(x, y, z - 1) && occupied(x, y, z + 1)
        if (hidden) continue

        if (voxels.length / 4 >= MAX_VOXELS) {
          truncated = true
          continue
        }

        let mapped = used.get(index)
        if (mapped === undefined) {
          mapped = used.size
          used.set(index, mapped)
        }
        voxels.push(x, y, z, mapped)
      }
    }
  }

  const order = [...used.entries()].sort((a, b) => a[1] - b[1]).map(([index]) => index)

  return {
    format: source.format,
    size: [sx, sy, sz],
    palette: order.map(i => palette[i]?.id ?? 'minecraft:stone'),
    colors: order.map(i => blockColor(palette[i]?.id ?? 'minecraft:stone')),
    voxels,
    total,
    shown: voxels.length / 4,
    truncated,
  }
}

export function withinPreviewBudget(size: { x: number, y: number, z: number }): boolean {
  return Math.abs(size.x) * Math.abs(size.y) * Math.abs(size.z) <= SCHEMATIC_LIMITS.maxVolume
}

export function emptyState(): BlockState {
  return parseStateString('minecraft:air')
}

// Positions and palette index all fit in 16 bits: coordinates are bounded by
// maxDimension and the index by maxPalette. As JSON the same data runs about
// five times larger, which for a big build is megabytes of digits.
export function encodeVoxels(payload: VoxelPayload): string {
  const packed = new Uint16Array(payload.voxels.length)
  for (let i = 0; i < payload.voxels.length; i++) packed[i] = payload.voxels[i]! & 0xFFFF
  return Buffer.from(packed.buffer).toString('base64')
}

export interface StoredPreview {
  format: SchematicFormat
  size: [number, number, number]
  palette: string[]
  colors: number[]
  voxels: string
  total: number
  shown: number
  truncated: boolean
}

export function previewDocument(payload: VoxelPayload): StoredPreview {
  return {
    format: payload.format,
    size: payload.size,
    palette: payload.palette,
    colors: payload.colors,
    voxels: encodeVoxels(payload),
    total: payload.total,
    shown: payload.shown,
    truncated: payload.truncated,
  }
}

export function previewKey(sha512: string): string {
  return `content/preview/${sha512.slice(0, 2)}/${sha512}.json`
}
