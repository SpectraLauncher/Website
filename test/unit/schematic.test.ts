import { describe, expect, it } from 'vitest'

import { fixture, hasFixtures } from '../fixtures'

import { asCompound, asNumber, readNbt } from '../../server/utils/nbt'
import {
  SCHEMATIC_LIMITS,
  type SchematicInfo,
  boundedVolume,
  detectFormat,
  itemsFor,
  legacyState,
  materialsOf,
  paletteBits,
  parseSchematic,
  parseStateString,
  unpackSpanning,
} from '../../server/utils/schematic'

// swamp_house is one and the same building exported to four formats. The three
// modern ones have to produce an identical material list — the strongest test
// available here: three independent encoders against our one decoder.
// Real builds by other people, so they are not in the repository; see
// test/fixtures/README.md. Absent in a fresh clone, and then this file skips
// rather than fails.
const NEEDS = [
  'swamp_house.litematic',
  'swamp_house.schem',
  'swamp_house.nbt',
  'swamp_house.schematic',
]
const present = hasFixtures(...NEEDS)

const load = (name: string) => fixture(name)
const parse = (name: string) => (present ? parseSchematic(load(name)) : null!)

const litematic = parse('swamp_house.litematic')
const sponge = parse('swamp_house.schem')
const structure = parse('swamp_house.nbt')
const mcedit = parse('swamp_house.schematic')

const materialMap = (info: SchematicInfo) =>
  Object.fromEntries(info.materials.map(m => [m.item, m.count]))

describe.skipIf(!present)('rozpoznawanie formatu', () => {
  it('idzie po ksztalcie NBT, nie po rozszerzeniu', () => {
    expect(detectFormat(readNbt(load('swamp_house.litematic')).value)).toBe('litematic')
    expect(detectFormat(readNbt(load('swamp_house.schem')).value)).toBe('sponge')
    expect(detectFormat(readNbt(load('swamp_house.nbt')).value)).toBe('structure')
    expect(detectFormat(readNbt(load('swamp_house.schematic')).value)).toBe('mcedit')
  })

  it('zwraca ten format w wyniku parsowania', () => {
    expect(litematic.format).toBe('litematic')
    expect(sponge.format).toBe('sponge')
    expect(structure.format).toBe('structure')
    expect(mcedit.format).toBe('mcedit')
  })
})

describe.skipIf(!present)('rozmiar i liczba blokow', () => {
  it('wszystkie cztery zgadzaja sie co do wymiarow', () => {
    for (const info of [litematic, sponge, structure, mcedit]) {
      expect(info.size, info.format).toEqual({ x: 15, y: 16, z: 15 })
      expect(info.volume, info.format).toBe(3600)
    }
  })

  // Litematica writes TotalBlocks itself. Agreement with our count means the
  // state array was unpacked entry for entry — the file verifies the decoder.
  it('licznik zgadza sie z TotalBlocks zapisanym przez Litematice', () => {
    const root = readNbt(load('swamp_house.litematic')).value
    const declared = asNumber(asCompound(root.Metadata)?.TotalBlocks)
    expect(declared).toBe(993)
    expect(litematic.blockCount).toBe(declared)
  })

  it('trzy nowoczesne formaty licza tyle samo blokow', () => {
    expect(sponge.blockCount).toBe(993)
    expect(structure.blockCount).toBe(993)
  })

  // Exporting to the pre-1.13 format is lossy: WorldEdit drops everything added
  // later (moss_block, azalea, cave_vines, hanging_roots...). The lower count is
  // a property of the file, not a parser bug.
  it('legacy ma mniej blokow, bo format nie zna nowszych', () => {
    expect(mcedit.blockCount).toBe(664)
    expect(mcedit.blockCount).toBeLessThan(litematic.blockCount)
  })
})

describe.skipIf(!present)('lista materialow', () => {
  it('trzy nowoczesne formaty daja identyczna liste', () => {
    expect(materialMap(sponge)).toEqual(materialMap(litematic))
    expect(materialMap(structure)).toEqual(materialMap(litematic))
  })

  it('nie zawiera powietrza ani wody', () => {
    for (const info of [litematic, sponge, structure, mcedit]) {
      const items = info.materials.map(m => m.item)
      expect(items, info.format).not.toContain('minecraft:air')
      expect(items, info.format).not.toContain('minecraft:water')
    }
  })

  // Twenty entries shared by both eras of the format agree to the block. Exactly
  // three diverge, and all three are the legacy file's fault, not the parser's:
  //
  //   spruce_door — WorldEdit wrote all four door blocks as the lower half (data
  //     without bit 8), so the file implies 4 doors instead of 2.
  //   spruce_slab — written under id 125 (double slab) instead of 126, so 16
  //     blocks are 32 slabs according to the file.
  //   flower_pot — before 1.13 the pot's contents lived in a TileEntity rather
  //     than in the block name, so the file shows a bare pot with no plant.
  //
  // We do not guess the correct value here. If this test starts failing, someone
  // changed the parser to fit these numbers — the file did not suddenly heal.
  it('zgadza sie z legacy wszedzie tam, gdzie legacy nie stracil informacji', () => {
    const modern = materialMap(litematic)
    const legacy = materialMap(mcedit)
    const lossy = ['minecraft:spruce_door', 'minecraft:spruce_slab', 'minecraft:flower_pot']

    const shared = Object.keys(legacy).filter(item => !lossy.includes(item))
    expect(shared.length).toBe(20)

    for (const item of shared) {
      expect(legacy[item], item).toBe(modern[item])
    }

    expect(modern['minecraft:spruce_door']).toBe(2)
    expect(legacy['minecraft:spruce_door']).toBe(4)
    expect(legacy['minecraft:spruce_slab']).toBe(32)
    expect(modern['minecraft:flower_pot']).toBe(5)
    expect(legacy['minecraft:flower_pot']).toBe(1)
  })

  it('jest posortowana malejaco', () => {
    const counts = litematic.materials.map(m => m.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('sumy sa dodatnie', () => {
    expect(litematic.materials.every(m => m.count > 0)).toBe(true)
    expect(litematic.materials.length).toBeGreaterThan(10)
  })
})

describe.skipIf(!present)('pulapki blokow wieloczesciowych', () => {
  it('drzwi licza sie raz, nie dwa razy', () => {
    const doors = litematic.materials.find(m => m.item === 'minecraft:spruce_door')
    const raw = litematic.palette.filter(id => id === 'minecraft:spruce_door')
    expect(raw).toHaveLength(1)
    expect(doors?.count).toBeGreaterThan(0)
    // Each door occupies two blocks, so without cutting the upper half the count
    // would be even and twice as large.
    expect(itemsFor({ id: 'minecraft:spruce_door', props: { half: 'upper' } })).toEqual([])
    expect(itemsFor({ id: 'minecraft:spruce_door', props: { half: 'lower' } }))
      .toEqual(['minecraft:spruce_door'])
  })

  it('gorne schody to nie gorna polowa drzwi', () => {
    expect(itemsFor({ id: 'minecraft:spruce_stairs', props: { half: 'top' } }))
      .toEqual(['minecraft:spruce_stairs'])
  })

  it('lozko liczy sie raz', () => {
    expect(itemsFor({ id: 'minecraft:red_bed', props: { part: 'head' } })).toEqual([])
    expect(itemsFor({ id: 'minecraft:red_bed', props: { part: 'foot' } }))
      .toEqual(['minecraft:red_bed'])
  })

  it('plyta podwojna to dwie plyty', () => {
    expect(itemsFor({ id: 'minecraft:spruce_slab', props: { type: 'double' } }))
      .toEqual(['minecraft:spruce_slab', 'minecraft:spruce_slab'])
    expect(itemsFor({ id: 'minecraft:spruce_slab', props: { type: 'top' } }))
      .toEqual(['minecraft:spruce_slab'])
  })

  it('waterlogged nie tworzy osobnego materialu', () => {
    const dry = itemsFor(parseStateString('minecraft:spruce_stairs[facing=north,waterlogged=false]'))
    const wet = itemsFor(parseStateString('minecraft:spruce_stairs[facing=north,waterlogged=true]'))
    expect(wet).toEqual(dry)
    expect(litematic.materials.map(m => m.item)).not.toContain('minecraft:water_bucket')
  })

  it('doniczka to doniczka plus roslina', () => {
    expect(itemsFor({ id: 'minecraft:potted_brown_mushroom', props: {} }))
      .toEqual(['minecraft:flower_pot', 'minecraft:brown_mushroom'])
    expect(itemsFor({ id: 'minecraft:potted_flowering_azalea_bush', props: {} }))
      .toEqual(['minecraft:flower_pot', 'minecraft:flowering_azalea'])
  })

  it('bloki bez wlasnego itemu mapuja sie na to, co sie zbiera', () => {
    expect(itemsFor({ id: 'minecraft:cave_vines', props: { berries: 'true' } }))
      .toEqual(['minecraft:glow_berries'])
    expect(itemsFor({ id: 'minecraft:cave_vines_plant', props: {} }))
      .toEqual(['minecraft:glow_berries'])
    expect(itemsFor({ id: 'minecraft:wall_torch', props: { facing: 'north' } }))
      .toEqual(['minecraft:torch'])
  })
})

describe.skipIf(!present)('rozpakowywanie tablicy stanow', () => {
  it('szerokosc wpisu to co najmniej 2 bity', () => {
    expect(paletteBits(1)).toBe(2)
    expect(paletteBits(4)).toBe(2)
    expect(paletteBits(5)).toBe(3)
    expect(paletteBits(110)).toBe(7)
    expect(paletteBits(256)).toBe(8)
    expect(paletteBits(257)).toBe(9)
  })

  // A vector worked out by hand from the spec: at 7 bits, entry 9 starts on bit
  // 63, so one bit sits in the first long and six in the second.
  // 1 | (0b101010 << 1) = 85.
  it('czyta wpis przechodzacy przez granice longa', () => {
    const longs = new BigInt64Array([BigInt.asIntN(64, 1n << 63n), 0b101010n])
    expect(unpackSpanning(longs, 7, 10)[9]).toBe(85)
  })

  it('odrzuca tablice krotsza, niz wynika z objetosci', () => {
    // 8 bits divides 64 evenly, so entry 8 already starts in the second long.
    expect(() => unpackSpanning(new BigInt64Array(1), 8, 100)).toThrow(/shorter than the declared size/)
    // 7 bits: entry 9 starts in the first long and ends in a second that is absent.
    expect(() => unpackSpanning(new BigInt64Array(1), 7, 10)).toThrow(/part-way through the last entry/)
  })
})

describe.skipIf(!present)('legacy ID', () => {
  it('rozklada warianty klody na typ i os', () => {
    expect(legacyState(17, 9)).toEqual({ id: 'minecraft:spruce_log', props: { axis: 'z' } })
    expect(legacyState(17, 4)).toEqual({ id: 'minecraft:oak_log', props: { axis: 'x' } })
    expect(legacyState(17, 13)).toEqual({ id: 'minecraft:spruce_wood', props: { axis: 'y' } })
  })

  it('czyta bit gornej polowy drzwi i wysokich roslin', () => {
    expect(legacyState(193, 1)?.props.half).toBe('lower')
    expect(legacyState(193, 9)?.props.half).toBe('upper')
    expect(legacyState(175, 3)).toEqual({ id: 'minecraft:large_fern', props: { half: 'lower' } })
    expect(legacyState(175, 11)).toEqual({ id: 'minecraft:large_fern', props: { half: 'upper' } })
  })

  it('nieznane ID nie znika po cichu', () => {
    expect(legacyState(9999, 0)).toBeNull()
  })

  it('prawdziwy plik legacy nie zostawia nieznanych ID', () => {
    expect(mcedit.unknown).toEqual([])
  })
})

describe.skipIf(!present)('metadane', () => {
  it('czyta nazwe i wersje danych, gdy format je ma', () => {
    expect(litematic.name).toBe('Main')
    expect(litematic.dataVersion).toBe(3955)
    expect(sponge.dataVersion).toBe(3955)
    expect(structure.dataVersion).toBeTypeOf('number')
  })

  it('budynek z samych blokow waniliowych nie wymaga modow', () => {
    for (const info of [litematic, sponge, structure, mcedit]) {
      expect(info.requiredMods, info.format).toEqual([])
    }
  })
})

describe.skipIf(!present)('parseStateString', () => {
  it('rozdziela id od wlasciwosci', () => {
    expect(parseStateString('minecraft:moss_block')).toEqual({ id: 'minecraft:moss_block', props: {} })
    expect(parseStateString('minecraft:oak_log[axis=x]'))
      .toEqual({ id: 'minecraft:oak_log', props: { axis: 'x' } })
    expect(parseStateString('minecraft:vine[east=true,north=false,up=false]'))
      .toEqual({ id: 'minecraft:vine', props: { east: 'true', north: 'false', up: 'false' } })
  })
})

describe.skipIf(!present)('materialsOf', () => {
  it('sumuje ten sam item z roznych stanow bloku', () => {
    expect(materialsOf([
      { state: parseStateString('minecraft:spruce_stairs[facing=north]'), count: 3 },
      { state: parseStateString('minecraft:spruce_stairs[facing=south]'), count: 4 },
      { state: parseStateString('minecraft:air'), count: 100 },
    ])).toEqual([{ item: 'minecraft:spruce_stairs', count: 7 }])
  })
})

describe.skipIf(!present)('limity twardosci', () => {
  it('przepuszcza normalny rozmiar', () => {
    expect(boundedVolume({ x: 15, y: 16, z: 15 })).toBe(3600)
  })

  it('odrzuca pojedyncza os ponad limit', () => {
    expect(() => boundedVolume({ x: SCHEMATIC_LIMITS.maxDimension + 1, y: 1, z: 1 }))
      .toThrow(/axis x/)
  })

  // Every axis is within the limit while the product is 68 billion blocks.
  // Without this check unpackSpanning tries to allocate an array for it.
  it('odrzuca objetosc, ktorej zadna pojedyncza os nie zdradza', () => {
    expect(() => boundedVolume({ x: 4096, y: 4096, z: 4096 })).toThrow(/over the/)
  })

  it('odrzuca NaN i nieskonczonosc', () => {
    expect(() => boundedVolume({ x: Number.NaN, y: 1, z: 1 })).toThrow()
    expect(() => boundedVolume({ x: Number.POSITIVE_INFINITY, y: 1, z: 1 })).toThrow()
  })
})
