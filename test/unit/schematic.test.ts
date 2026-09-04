import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

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

// swamp_house to jeden i ten sam budynek wyeksportowany do czterech formatow.
// Trzy nowoczesne musza dac identyczna liste materialow — to najmocniejszy test,
// jaki da sie tu napisac: trzy niezalezne enkodery kontra nasz dekoder.
const load = (name: string) => readFileSync(`test/fixtures/${name}`)
const parse = (name: string) => parseSchematic(load(name))

const litematic = parse('swamp_house.litematic')
const sponge = parse('swamp_house.schem')
const structure = parse('swamp_house.nbt')
const mcedit = parse('swamp_house.schematic')

const materialMap = (info: SchematicInfo) =>
  Object.fromEntries(info.materials.map(m => [m.item, m.count]))

describe('rozpoznawanie formatu', () => {
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

describe('rozmiar i liczba blokow', () => {
  it('wszystkie cztery zgadzaja sie co do wymiarow', () => {
    for (const info of [litematic, sponge, structure, mcedit]) {
      expect(info.size, info.format).toEqual({ x: 15, y: 16, z: 15 })
      expect(info.volume, info.format).toBe(3600)
    }
  })

  // Litematica sama zapisuje TotalBlocks. Zgodnosc z nasza liczba znaczy, ze
  // rozpakowanie tablicy stanow trafilo w kazdy wpis — plik weryfikuje dekoder.
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

  // Eksport do formatu sprzed 1.13 jest stratny: WorldEdit gubi wszystko, co
  // powstalo pozniej (moss_block, azalea, cave_vines, hanging_roots...). Mniejsza
  // liczba to wlasciwosc pliku, nie blad parsera.
  it('legacy ma mniej blokow, bo format nie zna nowszych', () => {
    expect(mcedit.blockCount).toBe(664)
    expect(mcedit.blockCount).toBeLessThan(litematic.blockCount)
  })
})

describe('lista materialow', () => {
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

  // Dwadziescia pozycji wspolnych dla obu epok formatu zgadza sie co do sztuki.
  // Rozjezdzaja sie dokladnie trzy i wszystkie z winy pliku legacy, nie parsera:
  //
  //   spruce_door — WorldEdit zapisal wszystkie cztery bloki drzwi jako dolna
  //     polowe (data bez bitu 8), wiec z pliku wynikaja 4 drzwi zamiast 2.
  //   spruce_slab — zapisal je pod ID 125 (plyta podwojna) zamiast 126, wiec
  //     16 blokow to wedlug pliku 32 plyty.
  //   flower_pot — przed 1.13 zawartosc doniczki siedziala w TileEntity, a nie w
  //     nazwie bloku, wiec z pliku widac sama doniczke bez rosliny.
  //
  // Nie zgadujemy tu poprawnej wartosci. Jesli ten test zacznie padac, znaczy to,
  // ze ktos zmienil parser pod te liczby — a nie ze plik nagle sie naprawil.
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

describe('pulapki blokow wieloczesciowych', () => {
  it('drzwi licza sie raz, nie dwa razy', () => {
    const doors = litematic.materials.find(m => m.item === 'minecraft:spruce_door')
    const raw = litematic.palette.filter(id => id === 'minecraft:spruce_door')
    expect(raw).toHaveLength(1)
    expect(doors?.count).toBeGreaterThan(0)
    // Kazde drzwi zajmuja dwa bloki, wiec bez odciecia gornej polowy liczba
    // bylaby parzysta i dwa razy wieksza.
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

describe('rozpakowywanie tablicy stanow', () => {
  it('szerokosc wpisu to co najmniej 2 bity', () => {
    expect(paletteBits(1)).toBe(2)
    expect(paletteBits(4)).toBe(2)
    expect(paletteBits(5)).toBe(3)
    expect(paletteBits(110)).toBe(7)
    expect(paletteBits(256)).toBe(8)
    expect(paletteBits(257)).toBe(9)
  })

  // Wektor policzony recznie ze specyfikacji: przy 7 bitach wpis numer 9 zaczyna
  // sie na bicie 63, wiec jeden bit siedzi w pierwszym longu, a szesc w drugim.
  // 1 | (0b101010 << 1) = 85.
  it('czyta wpis przechodzacy przez granice longa', () => {
    const longs = new BigInt64Array([BigInt.asIntN(64, 1n << 63n), 0b101010n])
    expect(unpackSpanning(longs, 7, 10)[9]).toBe(85)
  })

  it('odrzuca tablice krotsza, niz wynika z objetosci', () => {
    // 8 bitow dzieli 64 bez reszty, wiec wpis 8 zaczyna sie juz w drugim longu.
    expect(() => unpackSpanning(new BigInt64Array(1), 8, 100)).toThrow(/krotsza/)
    // 7 bitow: wpis 9 zaczyna sie w pierwszym longu i konczy w nieistniejacym drugim.
    expect(() => unpackSpanning(new BigInt64Array(1), 7, 10)).toThrow(/urywa sie/)
  })
})

describe('legacy ID', () => {
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

describe('metadane', () => {
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

describe('parseStateString', () => {
  it('rozdziela id od wlasciwosci', () => {
    expect(parseStateString('minecraft:moss_block')).toEqual({ id: 'minecraft:moss_block', props: {} })
    expect(parseStateString('minecraft:oak_log[axis=x]'))
      .toEqual({ id: 'minecraft:oak_log', props: { axis: 'x' } })
    expect(parseStateString('minecraft:vine[east=true,north=false,up=false]'))
      .toEqual({ id: 'minecraft:vine', props: { east: 'true', north: 'false', up: 'false' } })
  })
})

describe('materialsOf', () => {
  it('sumuje ten sam item z roznych stanow bloku', () => {
    expect(materialsOf([
      { state: parseStateString('minecraft:spruce_stairs[facing=north]'), count: 3 },
      { state: parseStateString('minecraft:spruce_stairs[facing=south]'), count: 4 },
      { state: parseStateString('minecraft:air'), count: 100 },
    ])).toEqual([{ item: 'minecraft:spruce_stairs', count: 7 }])
  })
})

describe('limity twardosci', () => {
  it('przepuszcza normalny rozmiar', () => {
    expect(boundedVolume({ x: 15, y: 16, z: 15 })).toBe(3600)
  })

  it('odrzuca pojedyncza os ponad limit', () => {
    expect(() => boundedVolume({ x: SCHEMATIC_LIMITS.maxDimension + 1, y: 1, z: 1 }))
      .toThrow(/axis x/)
  })

  // Kazda os miesci sie w limicie, a iloczyn to 68 miliardow blokow. Bez tego
  // sprawdzenia unpackSpanning probuje zaalokowac na to tablice.
  it('odrzuca objetosc, ktorej zadna pojedyncza os nie zdradza', () => {
    expect(() => boundedVolume({ x: 4096, y: 4096, z: 4096 })).toThrow(/over the/)
  })

  it('odrzuca NaN i nieskonczonosc', () => {
    expect(() => boundedVolume({ x: Number.NaN, y: 1, z: 1 })).toThrow()
    expect(() => boundedVolume({ x: Number.POSITIVE_INFINITY, y: 1, z: 1 })).toThrow()
  })
})
