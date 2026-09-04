import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ZIP_LIMITS,
  ZipError,
  openZip,
  readCentralDirectory,
  relaxJson,
  unsafeEntryName,
} from '../../server/utils/zip'

// Fixtury zrobione modulem zipfile z Pythona, czyli implementacja niezalezna od
// tej, ktora testujemy — inaczej test sprawdzalby tylko, czy nasz czytnik zgadza
// sie z naszym zapisywaczem.
const fixture = (name: string) => readFileSync(`test/fixtures/${name}`)

describe('odczyt archiwum', () => {
  it('czyta centralny katalog zwyklego jara', () => {
    const zip = openZip(fixture('sample-fabric-mod.jar'))
    expect(zip.entries.map(e => e.name)).toEqual([
      'fabric.mod.json',
      'META-INF/MANIFEST.MF',
      'assets/spectra_test/icon.png',
    ])
  })

  it('rozpakowuje wpis deflate', () => {
    const zip = openZip(fixture('sample-fabric-mod.jar'))
    const mod = zip.readJson<{ id: string, version: string, depends: Record<string, string> }>(
      'fabric.mod.json')
    expect(mod?.id).toBe('spectra_test')
    expect(mod?.version).toBe('1.4.2')
    expect(mod?.depends.minecraft).toBe('~1.20.1')
  })

  it('rozpakowuje wpis zapisany bez kompresji', () => {
    const zip = openZip(fixture('sample-fabric-mod.jar'))
    expect(zip.readText('META-INF/MANIFEST.MF')).toContain('Manifest-Version: 1.0')
    expect(zip.read('assets/spectra_test/icon.png')?.subarray(1, 4).toString()).toBe('PNG')
  })

  it('zwraca null dla wpisu, ktorego nie ma', () => {
    const zip = openZip(fixture('sample-fabric-mod.jar'))
    expect(zip.has('quilt.mod.json')).toBe(false)
    expect(zip.read('quilt.mod.json')).toBeNull()
    expect(zip.readJson('quilt.mod.json')).toBeNull()
  })

  it('znajduje EOCD, kiedy archiwum ma komentarz na koncu', () => {
    const zip = openZip(fixture('zip-comment.zip'))
    expect(zip.readJson<{ pack: { pack_format: number } }>('pack.mcmeta')?.pack.pack_format).toBe(15)
  })
})

describe('ochrona przed bomba', () => {
  it('odrzuca wpis o skrajnym wspolczynniku kompresji', () => {
    const zip = openZip(fixture('zip-bomb.zip'))
    expect(() => zip.read('zeros.bin')).toThrow(ZipError)
    expect(() => zip.read('zeros.bin')).toThrow(/wspolczynnik kompresji/)
  })

  it('odrzuca wpis wiekszy niz limit po rozpakowaniu', () => {
    const zip = openZip(fixture('zip-bomb.zip'), { ...ZIP_LIMITS, maxEntryUncompressed: 1024 })
    expect(() => zip.read('zeros.bin')).toThrow(/rozwija sie do/)
  })

  it('odrzuca archiwum o zbyt duzej sumie rozmiarow', () => {
    expect(() => openZip(fixture('zip-bomb.zip'), { ...ZIP_LIMITS, maxTotalUncompressed: 1024 }))
      .toThrow(/rozwija sie do wiecej niz/)
  })

  it('odrzuca archiwum o zbyt duzej liczbie wpisow', () => {
    expect(() => openZip(fixture('sample-fabric-mod.jar'), { ...ZIP_LIMITS, maxEntries: 2 }))
      .toThrow(/wpisow, limit to 2/)
  })

  // Limit liczony jest z centralnego katalogu, zanim cokolwiek zostanie
  // zinflatowane — sam odczyt katalogu nie moze wywolac rozpakowywania.
  it('otwarcie bomby samo w sobie nic nie rozpakowuje', () => {
    expect(() => openZip(fixture('zip-bomb.zip'))).not.toThrow()
  })
})

describe('uszkodzone wejscie', () => {
  it('odrzuca cos, co nie jest ZIP-em', () => {
    expect(() => openZip(Buffer.from('to nie jest archiwum, tylko zwykly tekst')))
      .toThrow(/to nie jest archiwum ZIP/)
  })

  it('odrzuca pusty bufor', () => {
    expect(() => openZip(new Uint8Array(0))).toThrow(ZipError)
  })

  it('odrzuca archiwum urwane w polowie', () => {
    const whole = fixture('sample-fabric-mod.jar')
    expect(() => openZip(whole.subarray(0, Math.floor(whole.length / 2)))).toThrow(ZipError)
  })

  it('odrzuca archiwum z podmienionym offsetem katalogu', () => {
    const buf = Buffer.from(fixture('sample-fabric-mod.jar'))
    const eocd = buf.length - 22
    buf.writeUInt32LE(0x7FFFFFF0, eocd + 16)
    expect(() => readCentralDirectory(buf)).toThrow(/wychodzi poza plik/)
  })
})

describe('unsafeEntryName', () => {
  it('przepuszcza normalne sciezki', () => {
    for (const name of ['fabric.mod.json', 'META-INF/mods.toml', 'assets/x/lang/en_us.json']) {
      expect(unsafeEntryName(name), name).toBe(false)
    }
  })

  it('odrzuca wyjscie z katalogu, sciezki absolutne i znaki sterujace', () => {
    for (const name of [
      '../../evil.txt',
      '/etc/passwd',
      'C:\\windows\\system32',
      'a\\b.txt',
      'zly\u0000.json',
      '',
    ]) {
      expect(unsafeEntryName(name), JSON.stringify(name)).toBe(true)
    }
  })

  it('rzeczywiste archiwum z traversalem jest wykrywalne po nazwach', () => {
    const zip = openZip(fixture('zip-traversal.zip'))
    expect(zip.entries.some(e => unsafeEntryName(e.name))).toBe(true)
    expect(zip.entries.filter(e => !unsafeEntryName(e.name)).map(e => e.name)).toEqual(['ok.txt'])
  })
})

describe('relaxJson', () => {
  it('zdejmuje komentarze liniowe i blokowe', () => {
    expect(JSON.parse(relaxJson('{ // komentarz\n "a": 1 }'))).toEqual({ a: 1 })
    expect(JSON.parse(relaxJson('{ /* blok */ "a": 1 }'))).toEqual({ a: 1 })
  })

  it('zdejmuje przecinek przed klamra', () => {
    expect(JSON.parse(relaxJson('{ "a": [1, 2,], }'))).toEqual({ a: [1, 2] })
  })

  it('nie rusza tego, co jest w stringu', () => {
    expect(JSON.parse(relaxJson('{ "a": "http://x/y", "b": "/* nie komentarz */" }')))
      .toEqual({ a: 'http://x/y', b: '/* nie komentarz */' })
  })

  it('radzi sobie z ucieczka przed cudzyslowem', () => {
    expect(JSON.parse(relaxJson('{ "a": "cytat \\" // tez nie komentarz" }')))
      .toEqual({ a: 'cytat " // tez nie komentarz' })
  })
})
