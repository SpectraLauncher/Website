import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { fixture, hasFixtures } from '../fixtures'

import {
  NbtError,
  asCompound,
  asList,
  asLongArray,
  asNumber,
  asString,
  decompressNbt,
  readNbt,
} from '../../server/utils/nbt'

// Real saves; see test/fixtures/README.md. The suites that only build
// buffers by hand run either way.
const SCHEMATICS = ['swamp_house.nbt', 'swamp_house.litematic', 'swamp_house.schem']
const present = hasFixtures(...SCHEMATICS)

describe('rozpakowanie', () => {
  it('rozpoznaje gzip po naglowku', () => {
    const plain = Buffer.from('nie jest spakowane, ale musi przejsc dalej')
    expect(decompressNbt(gzipSync(plain)).toString()).toBe(plain.toString())
    expect(decompressNbt(plain)).toEqual(plain)
  })

  it('odrzuca bufor za krotki, zeby byc czymkolwiek', () => {
    expect(() => decompressNbt(new Uint8Array(2))).toThrow(NbtError)
  })
})

describe.skipIf(!present)('odczyt prawdziwych plikow', () => {
  it('czyta korzen bloku struktury', () => {
    const { name, value } = readNbt(fixture('swamp_house.nbt'))
    expect(name).toBe('')
    expect(asList(value.size)?.map(v => asNumber(v))).toEqual([15, 16, 15])
    expect(asList(value.blocks)).toHaveLength(993)
  })

  it('czyta zagniezdzone zlozone tagi litematiki', () => {
    const { value } = readNbt(fixture('swamp_house.litematic'))
    const region = asCompound(asCompound(value.Regions)?.Main)
    expect(asString(asCompound(asCompound(value.Metadata))?.Name)).toBe('Main')
    expect(asLongArray(region?.BlockStates)).toHaveLength(394)
  })

  it('zachowuje longi jako bigint, nie traci precyzji', () => {
    const { value } = readNbt(fixture('swamp_house.litematic'))
    const states = asLongArray(asCompound(asCompound(value.Regions)?.Main)?.BlockStates)!
    expect(typeof states[0]).toBe('bigint')
    // Number could not hold this value — hence BigInt64Array.
    expect(states[0]).toBe(1369094286760478720n)
  })

  it('rozpoznaje puste listy zapisane jako TAG_End', () => {
    const { value } = readNbt(fixture('swamp_house.nbt'))
    expect(asList(value.entities)).toEqual([])
  })
})

describe.skipIf(!present)('wejscie od uzytkownika', () => {
  it('odrzuca korzen, ktory nie jest zlozonym tagiem', () => {
    expect(() => readNbt(gzipSync(Buffer.from([8, 0, 0])))).toThrow(/compound tag/)
  })

  it('odrzuca nieznany numer taga', () => {
    // COMPOUND root, empty name, then tag 99, which the spec does not define
    expect(() => readNbt(gzipSync(Buffer.from([10, 0, 0, 99, 0, 1, 0x61]))))
      .toThrow(/unknown NBT tag/)
  })

  it('odrzuca plik urwany w polowie wartosci', () => {
    const whole = fixture('swamp_house.schem')
    expect(() => readNbt(whole.subarray(0, 200))).toThrow()
  })

  // The array length is written in the file, so without a bounds check a declared
  // two billion elements would try to allocate memory.
  it('nie wierzy zadeklarowanej dlugosci tablicy', () => {
    const bomb = Buffer.from([
      10, 0, 0, // COMPOUND ""
      7, 0, 1, 0x61, // BYTE_ARRAY "a"
      0x7F, 0xFF, 0xFF, 0xFF, // dlugosc 2147483647
    ])
    expect(() => readNbt(gzipSync(bomb))).toThrow(/longer than the file/)
  })

  it('odrzuca ujemna dlugosc tablicy', () => {
    const bad = Buffer.from([10, 0, 0, 11, 0, 1, 0x61, 0xFF, 0xFF, 0xFF, 0xFF])
    expect(() => readNbt(gzipSync(bad))).toThrow(/negative length/)
  })

  it('odrzuca zagniezdzenie glebsze niz limit', () => {
    // 600 lists of compound tags that only ever open, never one close
    const deep = [10, 0, 0]
    for (let i = 0; i < 600; i++) deep.push(9, 0, 1, 0x61, 10, 0, 0, 0, 1)
    expect(() => readNbt(gzipSync(Buffer.from(deep)))).toThrow(/nested deeper/)
  })
})
