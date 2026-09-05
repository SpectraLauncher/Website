import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { externalRef } from '../../server/utils/dependencies'
import { readArchiveInfo } from '../../server/utils/mod-manifest'

const pack = readArchiveInfo(readFileSync('test/fixtures/sample-pack.mrpack'))

describe('czytanie mrpacka', () => {
  it('rozpoznaje modpack, a nie zwykle archiwum', () => {
    expect(pack.kind).toBe('modpack')
    expect(pack.name).toBe('Spectra Test Pack')
    expect(pack.version).toBe('1.2.0')
  })

  it('wyprowadza loader z klucza zaleznosci', () => {
    expect(pack.loaders).toEqual(['fabric'])
    expect(pack.gameVersionRange).toBe('1.20.1')
  })

  it('zbiera liste plikow z hashami', () => {
    expect(pack.packFiles).toHaveLength(2)
    expect(pack.packFiles[0]!.path).toBe('mods/sodium.jar')
    expect(pack.packFiles[0]!.hashes.sha512).toHaveLength(128)
    expect(pack.packFiles[0]!.size).toBe(1234)
  })
})

describe('externalRef', () => {
  // Adres CDN Modrintha niesie identyfikator projektu i wersji, wiec zaleznosc
  // wskazuje na konkretny projekt, a nie na goly link do pliku.
  it('wyciaga identyfikatory z adresu cdn', () => {
    const ref = externalRef(pack.packFiles[0]!)
    expect(ref.source).toBe('modrinth')
    expect(ref.projectId).toBe('AANobbMI')
    expect(ref.versionId).toBe('vvvvvvvv')
  })

  it('obcy adres zostaje samym linkiem', () => {
    const ref = externalRef(pack.packFiles[1]!)
    expect(ref.source).toBeUndefined()
    expect(ref.downloads).toEqual(['https://example.com/local-only.jar'])
    expect(ref.sha512).toHaveLength(128)
  })
})
