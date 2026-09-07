import { describe, expect, it } from 'vitest'

import { fixture, hasFixtures } from '../fixtures'

import { parseSchematic, schematicGrid } from '../../server/utils/schematic'
import { blockColor, voxelize } from '../../server/utils/schematic-voxels'

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

// A skipped describe still runs its own body, so anything built there has to be
// inert too, not only the tests inside it.
const load = (name: string) => fixture(name)
const gridOf = (name: string) => (present ? schematicGrid(load(name)) : null!)

const FORMATS = [
  'swamp_house.litematic',
  'swamp_house.schem',
  'swamp_house.nbt',
  'swamp_house.schematic',
]

const AIR = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'])

describe.skipIf(!present)('schematicGrid', () => {
  it.each(FORMATS)('%s ma wymiary zgodne z parserem zliczajacym', (file) => {
    const grid = schematicGrid(load(file))
    const info = parseSchematic(load(file))
    expect(grid.size).toEqual(info.size)
    expect(grid.indices).toHaveLength(info.volume)
  })

  // Siatka i licznik materialow to dwie niezalezne sciezki przez ten sam plik.
  // Jesli obie zgadzaja sie co do liczby nie-powietrza, indeksy trafiaja tam,
  // gdzie powinny — a to jest jedyna rzecz, ktora rendera moze zepsuc po cichu.
  it.each(FORMATS)('%s ma tyle nie-powietrza, ile naliczyl parser', (file) => {
    const grid = schematicGrid(load(file))
    const info = parseSchematic(load(file))

    let solid = 0
    for (const index of grid.indices) {
      if (!AIR.has(grid.palette[index]?.id ?? 'minecraft:air')) solid++
    }
    expect(solid).toBe(info.blockCount)
  })

  it('indeks nigdy nie wychodzi poza palete', () => {
    for (const file of FORMATS) {
      const grid = schematicGrid(load(file))
      for (const index of grid.indices) {
        expect(index, file).toBeLessThan(grid.palette.length)
      }
    }
  })

  // Blok struktury trzyma rzadka liste, wiec zero musi znaczyc powietrze — bez
  // przesuniecia palety kazda pusta komorka renderowalaby sie jako wpis zerowy.
  it('rzadki format nie zamienia pustki w pierwszy blok palety', () => {
    const grid = schematicGrid(load('swamp_house.nbt'))
    expect(grid.palette[0]!.id).toBe('minecraft:air')
  })
})

describe.skipIf(!present)('voxelize', () => {
  const grid = gridOf('swamp_house.litematic')
  const payload = present ? voxelize(grid) : null!

  it('liczy wszystkie bloki, ale pokazuje tylko widoczne', () => {
    expect(payload.total).toBe(993)
    expect(payload.shown).toBeGreaterThan(0)
    expect(payload.shown).toBeLessThanOrEqual(payload.total)
  })

  it('kazdy voxel to czworka x, y, z, indeks', () => {
    expect(payload.voxels.length % 4).toBe(0)
    expect(payload.voxels.length / 4).toBe(payload.shown)
  })

  it('pozycje mieszcza sie w wymiarach', () => {
    const [sx, sy, sz] = payload.size
    for (let i = 0; i < payload.voxels.length; i += 4) {
      expect(payload.voxels[i]!).toBeLessThan(sx)
      expect(payload.voxels[i + 1]!).toBeLessThan(sy)
      expect(payload.voxels[i + 2]!).toBeLessThan(sz)
      expect(payload.voxels[i + 3]!).toBeLessThan(payload.palette.length)
    }
  })

  it('paleta i kolory maja te sama dlugosc', () => {
    expect(payload.colors).toHaveLength(payload.palette.length)
  })

  it('nie umieszcza powietrza w palecie wyjsciowej', () => {
    for (const id of payload.palette) expect(AIR.has(id)).toBe(false)
  })

  // Pelny szescian ma n^3 blokow i tylko okolo 6n^2 widocznych. To jest roznica
  // miedzy scena, ktora dziala, a karta przegladarki, ktora przestaje odpowiadac.
  it('wycina wnetrze bryly', () => {
    const size = { x: 10, y: 10, z: 10 }
    const cube = voxelize({
      format: 'sponge',
      size,
      indices: new Uint32Array(1000).fill(1),
      palette: [{ id: 'minecraft:air', props: {} }, { id: 'minecraft:stone', props: {} }],
    })

    expect(cube.total).toBe(1000)
    // Skorupa szescianu 10x10x10 to 1000 minus wnetrze 8x8x8.
    expect(cube.shown).toBe(1000 - 512)
  })
})

describe.skipIf(!present)('blockColor', () => {
  it('zna bloki z tablicy', () => {
    expect(blockColor('minecraft:stone')).toBe(0x7D7D7D)
  })

  it('wyprowadza kolor rodziny drewna z nazwy', () => {
    expect(blockColor('minecraft:spruce_stairs')).toBe(blockColor('minecraft:spruce_fence'))
    expect(blockColor('minecraft:spruce_stairs')).not.toBe(blockColor('minecraft:birch_stairs'))
  })

  it('wyprowadza kolor barwnika z nazwy', () => {
    expect(blockColor('minecraft:lime_stained_glass')).toBe(0x70B919)
  })

  it('nieznany blok dostaje kolor stabilny i w zakresie', () => {
    const first = blockColor('somemod:mystery_block')
    expect(first).toBe(blockColor('somemod:mystery_block'))
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThanOrEqual(0xFFFFFF)
    expect(first).not.toBe(blockColor('somemod:other_block'))
  })
})
