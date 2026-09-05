import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { readArchiveInfo } from '../../server/utils/mod-manifest'
import { stripComment } from '../../server/utils/yaml'

const read = (name: string) => readArchiveInfo(readFileSync(`test/fixtures/${name}`))

const veinminer = read('veinminer-paper-2.12.1.jar')
const worldedit = read('worldedit-bukkit-7.4.5.jar')
const tab = read('TAB v6.1.2.jar')
const tabOld = read('TAB v5.3.2.jar')

describe('paper-plugin.yml', () => {
  it('czyta nazwe i wersje', () => {
    expect(veinminer.kind).toBe('plugin')
    expect(veinminer.name).toBe('Veinminer')
    expect(veinminer.version).toBe('2.12.1')
  })

  it('deskryptor papera nie obiecuje bukkita', () => {
    expect(veinminer.loaders).toContain('paper')
    expect(veinminer.loaders).toContain('purpur')
    expect(veinminer.loaders).not.toContain('bukkit')
    expect(veinminer.loaders).not.toContain('spigot')
  })

  it('folia dochodzi, bo plugin ja deklaruje', () => {
    expect(veinminer.loaders).toContain('folia')
  })
})

describe('plugin.yml', () => {
  it('czyta wersje w cudzyslowie', () => {
    expect(worldedit.name).toBe('WorldEdit')
    expect(worldedit.version).toBe('7.4.5+7590-b8dc4c1')
  })

  it('daje cala rodzine bukkita', () => {
    for (const loader of ['bukkit', 'spigot', 'paper', 'purpur']) {
      expect(worldedit.loaders, loader).toContain(loader)
    }
  })
})

// Jeden jar z deskryptorami kilku platform naraz. Zwracanie pierwszego
// trafionego opisywalo taki plik jako jednoplatformowy, a poniewaz manifesty
// modow sa sprawdzane wczesniej — jako moda fabricowego.
describe('jar wieloplatformowy', () => {
  it('zbiera platformy ze wszystkich deskryptorow, nie z pierwszego', () => {
    for (const loader of ['bukkit', 'spigot', 'paper', 'purpur', 'folia',
      'bungeecord', 'waterfall', 'velocity']) {
      expect(tab.loaders, loader).toContain(loader)
    }
  })

  it('nie gubi loaderow modowych, ktore ten sam jar niesie', () => {
    expect(tab.loaders.some(l => ['fabric', 'quilt', 'forge', 'neoforge'].includes(l))).toBe(true)
  })

  it('jest oznaczony jako wieloplatformowy, zeby typ wybral czlowiek', () => {
    expect(tab.multiPlatform).toBe(true)
  })

  it('starsze wydanie niesie takze sponge', () => {
    expect(tabOld.loaders).toContain('sponge')
  })

  it('numer wersji zgadza sie miedzy deskryptorami', () => {
    expect(tab.version).toBe('6.1.2')
    expect(tabOld.version).toBe('5.3.2')
  })
})

describe('komentarz po wartosci', () => {
  // TAB zapisuje api-version z komentarzem w tej samej linii. Metadane jara
  // wieloplatformowego biora sie z deskryptora moda, wiec sprawdzamy sama
  // funkcje obcinajaca i deskryptory, ktore przez nia przechodza.
  it('nie wchodzi do wartosci czytanej z pluginu', () => {
    expect(veinminer.gameVersionRange).toBe('1.21')
    expect(worldedit.gameVersionRange).toBe('1.21.4')
  })

  it('hash bez spacji przed nim nie jest komentarzem', () => {
    expect(stripComment('https://example.com/page#anchor')).toBe('https://example.com/page#anchor')
    expect(stripComment('1.13 # komentarz')).toBe('1.13 ')
    expect(stripComment('"a # b"')).toBe('"a # b"')
  })
})
