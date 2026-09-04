
import {
  type NbtCompound,
  asByteArray,
  asCompound,
  asList,
  asLongArray,
  asNumber,
  asString,
  readNbt,
} from './nbt'

export type SchematicFormat = 'litematic' | 'sponge' | 'structure' | 'mcedit'

export interface BlockState {
  id: string
  props: Record<string, string>
}

export interface Material {
  item: string
  count: number
}

export interface SchematicInfo {
  format: SchematicFormat
  name: string | null
  author: string | null
  dataVersion: number | null
  size: { x: number, y: number, z: number }
  volume: number
  blockCount: number
  palette: string[]
  materials: Material[]
  requiredMods: string[]
  unknown: string[]
}

export class SchematicError extends Error {}

function fail(message: string): never {
  throw new SchematicError(message)
}

// Every dimension here comes out of the uploaded file and is spent on an
// allocation, so each one needs a ceiling before it is used.
export const SCHEMATIC_LIMITS = {
  maxDimension: 32_768,
  maxVolume: 64 * 1024 * 1024,
  maxPalette: 65_536,
  maxBlockIdLength: 256,
}

// The three axes can each be individually plausible while their product is an
// allocation bomb — 32767 cubed is legal per axis and 3.5e13 entries in total.
// The product is what has to be checked, and before anything is allocated.
export function boundedVolume(size: { x: number, y: number, z: number }): number {
  const x = Math.abs(size.x)
  const y = Math.abs(size.y)
  const z = Math.abs(size.z)

  for (const [axis, value] of [['x', x], ['y', y], ['z', z]] as const) {
    if (!Number.isFinite(value) || value > SCHEMATIC_LIMITS.maxDimension) {
      fail(`axis ${axis} is ${value}, over the ${SCHEMATIC_LIMITS.maxDimension} limit`)
    }
  }

  const volume = x * y * z
  if (volume > SCHEMATIC_LIMITS.maxVolume) {
    fail(`schematic declares ${volume} blocks, over the ${SCHEMATIC_LIMITS.maxVolume} limit`)
  }
  return volume
}

function boundedPalette(entries: BlockState[]): BlockState[] {
  if (entries.length > SCHEMATIC_LIMITS.maxPalette) {
    fail(`palette has ${entries.length} entries, over the ${SCHEMATIC_LIMITS.maxPalette} limit`)
  }
  for (const entry of entries) {
    if (entry.id.length > SCHEMATIC_LIMITS.maxBlockIdLength) {
      fail('a block identifier is longer than the limit')
    }
  }
  return entries
}

// --- stan bloku ----------------------------------------------------------

export function parseStateString(raw: string): BlockState {
  const open = raw.indexOf('[')
  if (open === -1) return { id: raw, props: {} }

  const id = raw.slice(0, open)
  const props: Record<string, string> = {}
  for (const pair of raw.slice(open + 1, raw.lastIndexOf(']')).split(',')) {
    const eq = pair.indexOf('=')
    if (eq > 0) props[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
  }
  return { id, props }
}

function stateFromCompound(entry: NbtCompound): BlockState {
  const id = asString(entry.Name) ?? 'minecraft:air'
  const props: Record<string, string> = {}
  const raw = asCompound(entry.Properties)
  if (raw) {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') props[key] = value
    }
  }
  return { id, props }
}

// --- rozpakowywanie indeksow --------------------------------------------

// Litematica pakuje indeksy palety przez granice longow — zawsze, niezaleznie od
// MinecraftDataVersion. To nie jest to samo, co pakowanie sekcji chunka w samej
// grze, ktore przestalo przechodzic przez granice w 1.16; kto pomyli te dwie
// rzeczy, dostaje schemat wygladajacy jak szum.
//
// ponytail: arytmetyka na BigInt, wiec ~2 mln blokow to sekundy. Przepisac na
// pary 32-bitowe, jesli ktos wrzuci schemat wielkosci miasta.
export function unpackSpanning(longs: BigInt64Array, bits: number, count: number): Uint32Array {
  if (bits < 1 || bits > 32) fail(`nieobslugiwana szerokosc wpisu: ${bits}`)

  const out = new Uint32Array(count)
  const mask = (1n << BigInt(bits)) - 1n
  const width = BigInt(bits)

  for (let i = 0; i < count; i++) {
    const start = BigInt(i) * width
    const word = Number(start >> 6n)
    const offset = start & 63n

    if (word >= longs.length) fail('tablica stanow jest krotsza, niz wynika z rozmiaru')

    let value = (BigInt.asUintN(64, longs[word]!) >> offset) & mask
    if (offset + width > 64n) {
      if (word + 1 >= longs.length) fail('tablica stanow urywa sie na ostatnim wpisie')
      value |= (BigInt.asUintN(64, longs[word + 1]!) << (64n - offset)) & mask
    }
    out[i] = Number(value)
  }

  return out
}

export function readVarInts(bytes: Int8Array, count: number): Uint32Array {
  const out = new Uint32Array(count)
  let at = 0

  for (let i = 0; i < count; i++) {
    let value = 0
    let shift = 0
    for (;;) {
      if (at >= bytes.length) fail('tablica blokow urywa sie w polowie liczby')
      const byte = bytes[at++]! & 0xFF
      value |= (byte & 0x7F) << shift
      if ((byte & 0x80) === 0) break
      shift += 7
      if (shift > 35) fail('uszkodzona liczba zmiennej dlugosci')
    }
    out[i] = value >>> 0
  }

  return out
}

export function paletteBits(size: number): number {
  return Math.max(2, 32 - Math.clz32(Math.max(1, size - 1)))
}

// --- lista materialow ----------------------------------------------------

// Bloki, ktore nie maja itemu i nie licza sie do listy materialow.
const NOT_AN_ITEM = new Set([
  'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air',
  'minecraft:water', 'minecraft:lava', 'minecraft:fire', 'minecraft:soul_fire',
  'minecraft:piston_head', 'minecraft:moving_piston', 'minecraft:bubble_column',
  'minecraft:nether_portal', 'minecraft:end_portal', 'minecraft:end_gateway',
])

// Rejestr: blok -> itemy, ktore trzeba miec w rece. Domyslnie item nazywa sie tak
// samo jak blok, wiec tu leza wylacznie wyjatki. Dodanie kolejnego to jedna linia.
const BLOCK_ITEMS: Record<string, string[]> = {
  'minecraft:cave_vines': ['minecraft:glow_berries'],
  'minecraft:cave_vines_plant': ['minecraft:glow_berries'],
  'minecraft:weeping_vines_plant': ['minecraft:weeping_vines'],
  'minecraft:twisting_vines_plant': ['minecraft:twisting_vines'],
  'minecraft:redstone_wire': ['minecraft:redstone'],
  'minecraft:wall_torch': ['minecraft:torch'],
  'minecraft:soul_wall_torch': ['minecraft:soul_torch'],
  'minecraft:redstone_wall_torch': ['minecraft:redstone_torch'],
  'minecraft:tripwire': ['minecraft:string'],
  'minecraft:cocoa': ['minecraft:cocoa_beans'],
  'minecraft:melon_stem': ['minecraft:melon_seeds'],
  'minecraft:pumpkin_stem': ['minecraft:pumpkin_seeds'],
  'minecraft:attached_melon_stem': ['minecraft:melon_seeds'],
  'minecraft:attached_pumpkin_stem': ['minecraft:pumpkin_seeds'],
  'minecraft:carrots': ['minecraft:carrot'],
  'minecraft:potatoes': ['minecraft:potato'],
  'minecraft:beetroots': ['minecraft:beetroot_seeds'],
  'minecraft:wheat': ['minecraft:wheat_seeds'],
  'minecraft:bamboo_sapling': ['minecraft:bamboo'],
  'minecraft:sweet_berry_bush': ['minecraft:sweet_berries'],
  'minecraft:frosted_ice': [],
  'minecraft:farmland': ['minecraft:dirt'],
  'minecraft:dirt_path': ['minecraft:dirt'],
}

// Doniczka to dwa itemy: sama doniczka i to, co w niej stoi. Nazwa bloku niesie
// obie informacje, wiec regula wystarczy zamiast wpisu na kazdy kwiatek.
function pottedItems(id: string): string[] | null {
  const plant = id.replace(/^minecraft:potted_/, '')
  if (plant === id) return null
  return ['minecraft:flower_pot', `minecraft:${plant.replace(/_bush$/, '')}`]
}

// Druga polowa bloku dwuczesciowego nie kosztuje osobnego itemu.
//
// `half` ma tu dwa rozlaczne zestawy wartosci: drzwi i wysokie rosliny uzywaja
// lower/upper, a schody i klapy top/bottom — dlatego sprawdzenie na 'upper' nie
// wycina przypadkiem gornych schodow.
function isSecondHalf(state: BlockState): boolean {
  return state.props.half === 'upper' || state.props.part === 'head'
}

export function itemsFor(state: BlockState): string[] {
  if (NOT_AN_ITEM.has(state.id)) return []
  if (isSecondHalf(state)) return []

  const potted = pottedItems(state.id)
  if (potted) return potted

  const mapped = BLOCK_ITEMS[state.id]
  const items = mapped ?? [state.id]

  // Plyta podwojna to dwie plyty w rece, nie jedna.
  if (state.props.type === 'double') return [...items, ...items]

  return items
}

export function materialsOf(counted: Array<{ state: BlockState, count: number }>): Material[] {
  const totals = new Map<string, number>()

  for (const { state, count } of counted) {
    for (const item of itemsFor(state)) {
      totals.set(item, (totals.get(item) ?? 0) + count)
    }
  }

  return [...totals]
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item))
}

// --- legacy: numeryczne ID sprzed 1.13 -----------------------------------

const LOG_TYPES = ['oak', 'spruce', 'birch', 'jungle']
const LOG_AXES = ['y', 'x', 'z']
const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']

// Rejestr: numeryczne ID sprzed 1.13 -> nowoczesny blok. Klucz to `id` albo
// `id:data`, a funkcja obsluguje rodziny, w ktorych data koduje wariant.
//
// Lista jest celowo niepelna — pokrywa to, co WorldEdit faktycznie zapisuje w
// budynkach, i rosnie o kolejny wpis wtedy, kiedy jakis plik go potrzebuje.
// Czego tu nie ma, wychodzi w SchematicInfo.unknown zamiast zniknac po cichu.
const LEGACY: Record<number, (data: number) => BlockState | null> = {
  0: () => ({ id: 'minecraft:air', props: {} }),
  1: d => ({ id: ['minecraft:stone', 'minecraft:granite', 'minecraft:polished_granite',
    'minecraft:diorite', 'minecraft:polished_diorite', 'minecraft:andesite',
    'minecraft:polished_andesite'][d] ?? 'minecraft:stone', props: {} }),
  2: () => ({ id: 'minecraft:grass_block', props: {} }),
  3: d => ({ id: d === 2 ? 'minecraft:podzol' : 'minecraft:dirt', props: {} }),
  4: () => ({ id: 'minecraft:cobblestone', props: {} }),
  5: d => ({ id: `minecraft:${['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][d] ?? 'oak'}_planks`, props: {} }),
  12: d => ({ id: d === 1 ? 'minecraft:red_sand' : 'minecraft:sand', props: {} }),
  13: () => ({ id: 'minecraft:gravel', props: {} }),
  17: (d) => {
    const type = LOG_TYPES[d & 3] ?? 'oak'
    const axis = d >> 2
    return axis === 3
      ? { id: `minecraft:${type}_wood`, props: { axis: 'y' } }
      : { id: `minecraft:${type}_log`, props: { axis: LOG_AXES[axis] ?? 'y' } }
  },
  18: d => ({ id: `minecraft:${LOG_TYPES[d & 3] ?? 'oak'}_leaves`, props: {} }),
  20: () => ({ id: 'minecraft:glass', props: {} }),
  30: () => ({ id: 'minecraft:cobweb', props: {} }),
  31: d => ({ id: ['minecraft:dead_bush', 'minecraft:short_grass', 'minecraft:fern'][d]
    ?? 'minecraft:short_grass', props: {} }),
  32: () => ({ id: 'minecraft:dead_bush', props: {} }),
  35: d => ({ id: `minecraft:${DYES[d] ?? 'white'}_wool`, props: {} }),
  37: () => ({ id: 'minecraft:dandelion', props: {} }),
  38: d => ({ id: ['minecraft:poppy', 'minecraft:blue_orchid', 'minecraft:allium',
    'minecraft:azure_bluet', 'minecraft:red_tulip', 'minecraft:orange_tulip',
    'minecraft:white_tulip', 'minecraft:pink_tulip', 'minecraft:oxeye_daisy'][d]
    ?? 'minecraft:poppy', props: {} }),
  39: () => ({ id: 'minecraft:brown_mushroom', props: {} }),
  40: () => ({ id: 'minecraft:red_mushroom', props: {} }),
  44: d => ({ id: `minecraft:${['stone', 'sandstone', 'oak', 'cobblestone', 'brick',
    'stone_brick', 'nether_brick', 'quartz'][d & 7] ?? 'stone'}_slab`,
  props: { type: (d & 8) === 8 ? 'top' : 'bottom' } }),
  45: () => ({ id: 'minecraft:bricks', props: {} }),
  47: () => ({ id: 'minecraft:bookshelf', props: {} }),
  48: () => ({ id: 'minecraft:mossy_cobblestone', props: {} }),
  50: () => ({ id: 'minecraft:torch', props: {} }),
  53: () => ({ id: 'minecraft:oak_stairs', props: {} }),
  54: () => ({ id: 'minecraft:chest', props: {} }),
  58: () => ({ id: 'minecraft:crafting_table', props: {} }),
  61: () => ({ id: 'minecraft:furnace', props: {} }),
  63: () => ({ id: 'minecraft:oak_sign', props: {} }),
  64: d => ({ id: 'minecraft:oak_door', props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
  65: () => ({ id: 'minecraft:ladder', props: {} }),
  67: () => ({ id: 'minecraft:cobblestone_stairs', props: {} }),
  85: () => ({ id: 'minecraft:oak_fence', props: {} }),
  86: () => ({ id: 'minecraft:carved_pumpkin', props: {} }),
  87: () => ({ id: 'minecraft:netherrack', props: {} }),
  89: () => ({ id: 'minecraft:glowstone', props: {} }),
  95: d => ({ id: `minecraft:${DYES[d] ?? 'white'}_stained_glass`, props: {} }),
  96: d => ({ id: 'minecraft:oak_trapdoor', props: { half: (d & 8) === 8 ? 'top' : 'bottom' } }),
  98: d => ({ id: ['minecraft:stone_bricks', 'minecraft:mossy_stone_bricks',
    'minecraft:cracked_stone_bricks', 'minecraft:chiseled_stone_bricks'][d]
    ?? 'minecraft:stone_bricks', props: {} }),
  101: () => ({ id: 'minecraft:iron_bars', props: {} }),
  102: () => ({ id: 'minecraft:glass_pane', props: {} }),
  106: () => ({ id: 'minecraft:vine', props: {} }),
  109: () => ({ id: 'minecraft:stone_brick_stairs', props: {} }),
  111: () => ({ id: 'minecraft:lily_pad', props: {} }),
  118: () => ({ id: 'minecraft:cauldron', props: {} }),
  125: d => ({ id: `minecraft:${['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][d & 7] ?? 'oak'}_slab`,
    props: { type: 'double' } }),
  126: d => ({ id: `minecraft:${['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'][d & 7] ?? 'oak'}_slab`,
    props: { type: (d & 8) === 8 ? 'top' : 'bottom' } }),
  128: () => ({ id: 'minecraft:sandstone_stairs', props: {} }),
  134: () => ({ id: 'minecraft:spruce_stairs', props: {} }),
  135: () => ({ id: 'minecraft:birch_stairs', props: {} }),
  136: () => ({ id: 'minecraft:jungle_stairs', props: {} }),
  139: d => ({ id: d === 1 ? 'minecraft:mossy_cobblestone_wall' : 'minecraft:cobblestone_wall', props: {} }),
  140: () => ({ id: 'minecraft:flower_pot', props: {} }),
  155: () => ({ id: 'minecraft:quartz_block', props: {} }),
  159: d => ({ id: `minecraft:${DYES[d] ?? 'white'}_terracotta`, props: {} }),
  162: (d) => {
    const type = ['acacia', 'dark_oak'][d & 1] ?? 'acacia'
    const axis = d >> 2
    return axis === 3
      ? { id: `minecraft:${type}_wood`, props: { axis: 'y' } }
      : { id: `minecraft:${type}_log`, props: { axis: LOG_AXES[axis] ?? 'y' } }
  },
  163: () => ({ id: 'minecraft:acacia_stairs', props: {} }),
  164: () => ({ id: 'minecraft:dark_oak_stairs', props: {} }),
  170: () => ({ id: 'minecraft:hay_block', props: {} }),
  171: d => ({ id: `minecraft:${DYES[d] ?? 'white'}_carpet`, props: {} }),
  175: d => ({ id: ['minecraft:sunflower', 'minecraft:lilac', 'minecraft:tall_grass',
    'minecraft:large_fern', 'minecraft:rose_bush', 'minecraft:peony'][d & 7] ?? 'minecraft:tall_grass',
  props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
  188: () => ({ id: 'minecraft:spruce_fence', props: {} }),
  189: () => ({ id: 'minecraft:birch_fence', props: {} }),
  190: () => ({ id: 'minecraft:jungle_fence', props: {} }),
  191: () => ({ id: 'minecraft:dark_oak_fence', props: {} }),
  192: () => ({ id: 'minecraft:acacia_fence', props: {} }),
  193: d => ({ id: 'minecraft:spruce_door', props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
  194: d => ({ id: 'minecraft:birch_door', props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
  195: d => ({ id: 'minecraft:jungle_door', props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
  196: d => ({ id: 'minecraft:acacia_door', props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
  197: d => ({ id: 'minecraft:dark_oak_door', props: { half: (d & 8) === 8 ? 'upper' : 'lower' } }),
}

export function legacyState(id: number, data: number): BlockState | null {
  return LEGACY[id]?.(data) ?? null
}

// --- parsery formatow ----------------------------------------------------

interface Counted { state: BlockState, count: number }

function summarize(
  format: SchematicFormat,
  size: { x: number, y: number, z: number },
  counted: Counted[],
  extra: { name?: string | null, author?: string | null, dataVersion?: number | null,
    unknown?: string[] } = {},
): SchematicInfo {
  const volume = boundedVolume(size)
  const present = counted.filter(c => c.count > 0 && !NOT_AN_ITEM.has(c.state.id))

  const palette = [...new Set(present.map(c => c.state.id))].sort()
  const requiredMods = [...new Set(
    palette.map(id => id.split(':')[0]!).filter(ns => ns !== 'minecraft'),
  )].sort()

  return {
    format,
    name: extra.name ?? null,
    author: extra.author ?? null,
    dataVersion: extra.dataVersion ?? null,
    size: { x: Math.abs(size.x), y: Math.abs(size.y), z: Math.abs(size.z) },
    volume,
    blockCount: present.reduce((sum, c) => sum + c.count, 0),
    palette,
    materials: materialsOf(counted),
    requiredMods,
    unknown: extra.unknown ?? [],
  }
}

function tally(indices: Uint32Array, palette: BlockState[]): Counted[] {
  const counts = new Uint32Array(palette.length)
  for (const index of indices) {
    if (index < palette.length) counts[index]!++
  }
  return palette.map((state, i) => ({ state, count: counts[i]! }))
}

// Litematica. Regionow moze byc kilka; kazdy ma wlasna palete i wlasna tablice
// stanow, wiec materialy sumujemy po wszystkich, a rozmiar bierzemy z metadanych.
export function parseLitematic(root: NbtCompound): SchematicInfo {
  const meta = asCompound(root.Metadata)
  const regions = asCompound(root.Regions)
  if (!regions) fail('brak sekcji Regions')

  const counted: Counted[] = []

  for (const region of Object.values(regions)) {
    const body = asCompound(region)
    const size = asCompound(body?.Size)
    const paletteRaw = asList(body?.BlockStatePalette)
    const states = asLongArray(body?.BlockStates)
    if (!body || !size || !paletteRaw || !states) continue

    const palette = boundedPalette(paletteRaw.map(e => stateFromCompound(asCompound(e) ?? {})))
    const volume = boundedVolume({
      x: asNumber(size.x) ?? 0,
      y: asNumber(size.y) ?? 0,
      z: asNumber(size.z) ?? 0,
    })

    // The array either holds exactly the packed volume or the file is wrong.
    // Checking here turns a confusing mid-unpack failure into one clear message.
    const bits = paletteBits(palette.length)
    const expected = Math.ceil(volume * bits / 64)
    if (states.length !== expected) {
      fail(`region declares ${volume} blocks at ${bits} bits, which needs `
        + `${expected} longs, but the array holds ${states.length}`)
    }

    counted.push(...tally(unpackSpanning(states, bits, volume), palette))
  }

  const enclosing = asCompound(meta?.EnclosingSize)
  const size = {
    x: asNumber(enclosing?.x) ?? 0,
    y: asNumber(enclosing?.y) ?? 0,
    z: asNumber(enclosing?.z) ?? 0,
  }

  return summarize('litematic', size, counted, {
    name: asString(meta?.Name) || null,
    author: asString(meta?.Author) || null,
    dataVersion: asNumber(root.MinecraftDataVersion) ?? null,
  })
}

// Sponge Schematic. W wersji 3 paleta i dane siedza w podsekcji Blocks, w
// wersji 2 lezaly plasko obok siebie pod innymi nazwami.
export function parseSponge(root: NbtCompound): SchematicInfo {
  const body = asCompound(root.Schematic) ?? root
  const blocks = asCompound(body.Blocks)

  const paletteRaw = asCompound(blocks?.Palette ?? body.Palette)
  const data = asByteArray(blocks?.Data ?? body.BlockData)
  if (!paletteRaw || !data) fail('brak palety albo danych blokow')

  const size = {
    x: asNumber(body.Width) ?? 0,
    y: asNumber(body.Height) ?? 0,
    z: asNumber(body.Length) ?? 0,
  }
  const volume = boundedVolume(size)

  // Paleta jest mapa nazwa -> indeks, a nie lista, wiec kolejnosc kluczy nic nie
  // znaczy i trzeba ja przelozyc na tablice po wartosci indeksu.
  const palette: BlockState[] = []
  for (const [name, index] of Object.entries(paletteRaw)) {
    const at = asNumber(index)
    if (at !== undefined) palette[at] = parseStateString(name)
  }
  for (let i = 0; i < palette.length; i++) {
    palette[i] ??= { id: 'minecraft:air', props: {} }
  }

  boundedPalette(palette)

  return summarize('sponge', size, tally(readVarInts(data, volume), palette), {
    dataVersion: asNumber(body.DataVersion) ?? null,
    name: asString(asCompound(body.Metadata)?.Name) || null,
  })
}

// Blok struktury. Lista blokow jest rzadka — zawiera wylacznie postawione bloki,
// wiec objetosc bierze sie z pola size, a nie z dlugosci listy.
export function parseStructure(root: NbtCompound): SchematicInfo {
  const sizeList = asList(root.size)
  const paletteRaw = asList(root.palette)
  const blocks = asList(root.blocks)
  if (!sizeList || !paletteRaw || !blocks) fail('brak size, palette albo blocks')

  const size = {
    x: asNumber(sizeList[0]) ?? 0,
    y: asNumber(sizeList[1]) ?? 0,
    z: asNumber(sizeList[2]) ?? 0,
  }

  boundedVolume(size)
  const palette = boundedPalette(paletteRaw.map(e => stateFromCompound(asCompound(e) ?? {})))
  const counts = new Uint32Array(palette.length)

  for (const entry of blocks) {
    const at = asNumber(asCompound(entry)?.state)
    if (at !== undefined && at < palette.length) counts[at]!++
  }

  const counted = palette.map((state, i) => ({ state, count: counts[i]! }))
  return summarize('structure', size, counted, {
    dataVersion: asNumber(root.DataVersion) ?? null,
  })
}

// MCEdit sprzed 1.13: dwie tablice bajtow, numeryczne ID i cztery bity wariantu.
// AddBlocks niesie starszy nibble dla ID powyzej 255.
export function parseMcEdit(root: NbtCompound): SchematicInfo {
  const blocks = asByteArray(root.Blocks)
  const data = asByteArray(root.Data)
  if (!blocks) fail('brak tablicy Blocks')

  const add = asByteArray(root.AddBlocks) ?? asByteArray(root.Add)
  const size = {
    x: asNumber(root.Width) ?? 0,
    y: asNumber(root.Height) ?? 0,
    z: asNumber(root.Length) ?? 0,
  }

  const counts = new Map<string, { state: BlockState, count: number }>()
  const unknown = new Set<string>()

  for (let i = 0; i < blocks.length; i++) {
    let id = blocks[i]! & 0xFF
    if (add) {
      // Jeden bajt AddBlocks trzyma starsze nibble dwoch kolejnych blokow.
      const nibble = (i & 1) === 0
        ? (add[i >> 1]! & 0xF0) >> 4
        : add[i >> 1]! & 0x0F
      id |= nibble << 8
    }

    const variant = data ? data[i]! & 0x0F : 0
    const state = legacyState(id, variant)

    if (!state) {
      unknown.add(`${id}:${variant}`)
      continue
    }

    const key = `${state.id}|${JSON.stringify(state.props)}`
    const seen = counts.get(key)
    if (seen) seen.count++
    else counts.set(key, { state, count: 1 })
  }

  return summarize('mcedit', size, [...counts.values()], {
    name: asString(root.Name) || null,
    unknown: [...unknown].sort(),
  })
}

// Format rozpoznajemy po ksztalcie NBT, nie po rozszerzeniu — rozszerzenie to
// deklaracja uzytkownika, a uklad tagow to fakt.
export function detectFormat(root: NbtCompound): SchematicFormat {
  if (root.Regions && root.Metadata) return 'litematic'
  if (root.Schematic || (root.Palette && root.BlockData)) return 'sponge'
  if (root.blocks && root.palette && root.size) return 'structure'
  if (root.Blocks && root.Width) return 'mcedit'
  return fail('nieznany format schematu')
}

export function parseSchematic(body: Uint8Array): SchematicInfo {
  const { value: root } = readNbt(body)

  switch (detectFormat(root)) {
    case 'litematic': return parseLitematic(root)
    case 'sponge': return parseSponge(root)
    case 'structure': return parseStructure(root)
    case 'mcedit': return parseMcEdit(root)
  }
}
