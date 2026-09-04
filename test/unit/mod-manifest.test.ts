import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { readArchiveInfo } from '../../server/utils/mod-manifest'
import { parseManifest, parseToml } from '../../server/utils/toml'

// Jade w trzech wydaniach to ten sam mod na trzech loaderach — modId musi wyjsc
// identyczny, a loader i wersja rozne.
const read = (name: string) => readArchiveInfo(readFileSync(`test/fixtures/${name}`))

const forge = read('Jade-1.20.1-Forge-11.13.3.jar')
const neoforge = read('Jade-1.21.1-NeoForge-15.10.6.jar')
const fabric = read('Jade-mc26.1-Fabric-26.1.9.jar')
const shader = read('ComplementaryReimagined_r5.9.zip')
const resourcepack = read('Better-Leaves-9.5.zip')

describe('rozpoznanie rodzaju archiwum', () => {
  it('odroznia moda, shaderpack i resourcepack', () => {
    expect(forge.kind).toBe('mod')
    expect(neoforge.kind).toBe('mod')
    expect(fabric.kind).toBe('mod')
    expect(shader.kind).toBe('shader')
    expect(resourcepack.kind).toBe('resourcepack')
  })

  it('kazde wydanie zglasza swoj loader', () => {
    expect(forge.loaders).toEqual(['forge'])
    expect(neoforge.loaders).toEqual(['neoforge'])
    expect(fabric.loaders).toEqual(['fabric'])
  })

  // NeoForge zostawia w jarze rowniez stary META-INF/mods.toml, wiec kolejnosc
  // w rejestrze manifestow decyduje o tym, ktory loader wygra.
  it('neoforge nie jest brany za forge', () => {
    expect(neoforge.loaders).not.toContain('forge')
  })
})

describe('metadane moda', () => {
  it('modId jest ten sam we wszystkich trzech wydaniach', () => {
    expect(forge.modId).toBe('jade')
    expect(neoforge.modId).toBe('jade')
    expect(fabric.modId).toBe('jade')
  })

  it('nazwa, autor i opis wychodza z manifestu', () => {
    for (const info of [forge, neoforge, fabric]) {
      expect(info.name, String(info.loaders)).toBe('Jade')
      expect(info.authors, String(info.loaders)).toEqual(['Snownee'])
      expect(info.description, String(info.loaders)).toContain('what you are looking at')
    }
  })

  it('licencja jest czytana, mimo ze kazde wydanie zapisuje ja inaczej', () => {
    expect(forge.license).toBe('CC BY-NC-SA 4.0')
    expect(neoforge.license).toBe('CC-BY-NC-SA-4.0')
    expect(fabric.license).toBe('CC-BY-NC-SA-4.0')
  })

  it('zbiera linki z manifestu', () => {
    expect(forge.links.homepage).toContain('curseforge.com')
    expect(fabric.links.sources).toBe('https://github.com/Snownee/Jade')
    expect(fabric.links.issues).toBe('https://github.com/Snownee/Jade/issues')
  })
})

describe('wersja', () => {
  it('fabric podaje ja wprost', () => {
    expect(fabric.version).toBe('26.1.9+fabric')
  })

  // Forge i NeoForge wpisuja w mods.toml doslownie "${file.jarVersion}" i
  // podstawiaja prawdziwa wersje z MANIFEST.MF dopiero przy ladowaniu.
  it('forge i neoforge sa czytane z manifestu, nie z placeholdera', () => {
    expect(forge.version).toBe('11.13.3+forge')
    expect(neoforge.version).not.toContain('${')
    expect(neoforge.version).toBeTruthy()
  })
})

describe('wersje gry', () => {
  // Manifest podaje zakres, nie liste wydan. Rozwiniecie go wymagaloby listy
  // wszystkich wersji Minecrafta, wiec zakres idzie dalej jako tekst.
  it('fabric niesie zakres z depends.minecraft', () => {
    expect(fabric.gameVersionRange).toBe('>=26.1')
  })

  it('brak zaleznosci od minecrafta zostawia puste pole zamiast zgadywanki', () => {
    expect(forge.gameVersionRange).toBeNull()
  })
})

describe('paczki bez manifestu moda', () => {
  it('resourcepack niesie pack_format', () => {
    expect(resourcepack.packFormat).toBeTypeOf('number')
    expect(resourcepack.packFormat).toBeGreaterThan(0)
  })

  it('shaderpack rozpoznaje silniki po zawartosci, bo manifestu nie ma', () => {
    expect(shader.shaderEngines).toContain('iris')
    expect(shader.shaderEngines).toContain('optifine')
    expect(shader.packFormat).toBeNull()
  })

  it('mod tez ma pack.mcmeta i to nie robi z niego resourcepacka', () => {
    expect(forge.kind).toBe('mod')
    expect(forge.packFormat).toBe(12)
  })
})

describe('parseToml', () => {
  it('czyta tablice tabel', () => {
    const toml = parseToml(`
      modLoader = "javafml"
      [[mods]]
      modId = "a"
      [[mods]]
      modId = "b"
    `)
    expect(toml.modLoader).toBe('javafml')
    expect((toml.mods as any[]).map(m => m.modId)).toEqual(['a', 'b'])
  })

  it('czyta zagniezdzona tablice tabel po kluczu z kropka', () => {
    const toml = parseToml(`
      [[dependencies.jade]]
      modId = "minecraft"
      versionRange = "[1.20.1]"
    `)
    expect((toml.dependencies as any).jade[0].versionRange).toBe('[1.20.1]')
  })

  it('czyta string wielolinijkowy', () => {
    const toml = parseToml(`description = '''\nlinia jedna\nlinia dwa'''`)
    expect(toml.description).toBe('linia jedna\nlinia dwa')
  })

  it('czyta liczby, wartosci logiczne i tablice', () => {
    const toml = parseToml(`n = 42\nb = true\nlist = ["a", "b"]`)
    expect(toml.n).toBe(42)
    expect(toml.b).toBe(true)
    expect(toml.list).toEqual(['a', 'b'])
  })

  it('przecinek w stringu nie rozbija tablicy', () => {
    expect(parseToml(`a = ["x, y", "z"]`).a).toEqual(['x, y', 'z'])
  })

  it('pomija komentarze i puste linie', () => {
    expect(parseToml(`# komentarz\n\nklucz = "wartosc"`).klucz).toBe('wartosc')
  })
})

describe('parseManifest', () => {
  // Manifest lamie linie po 72 bajtach w dowolnym miejscu, takze w srodku slowa,
  // a kontynuacja doklada sie bez zadnej spacji — wiodaca spacja jest znacznikiem
  // kontynuacji, nie czescia wartosci.
  it('skleja zawiniete linie bez wstawiania spacji', () => {
    const manifest = parseManifest(
      'Manifest-Version: 1.0\nImplementation-URL: https://example.com/bardzo/dl\n uga/sciezka\nX: 1')
    expect(manifest['Implementation-URL']).toBe('https://example.com/bardzo/dluga/sciezka')
    expect(manifest.X).toBe('1')
  })

  it('czyta wersje z prawdziwego jara', () => {
    expect(forge.version).toBe('11.13.3+forge')
  })
})
