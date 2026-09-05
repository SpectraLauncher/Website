import { describe, expect, it } from 'vitest'

import {
  LICENSES,
  PROJECT_TYPES,
  TYPE_PREFIX,
  isLicense,
  isProjectType,
  isVersionChannel,
  loadersForType,
  projectPath,
} from '../../server/utils/catalog-types'

describe('typy projektow', () => {
  it('kazdy typ ma prefiks URL i kazdy prefiks jest unikalny', () => {
    const prefixes = PROJECT_TYPES.map(type => TYPE_PREFIX[type])
    expect(prefixes.filter(Boolean)).toHaveLength(PROJECT_TYPES.length)
    expect(new Set(prefixes).size).toBe(PROJECT_TYPES.length)
  })

  it('sklada sciezke projektu', () => {
    expect(projectPath('mod', 'sodium')).toBe('/mod/sodium')
    expect(projectPath('modpack', 'better-mc')).toBe('/pack/better-mc')
    expect(projectPath('schematic', 'zamek')).toBe('/schematic/zamek')
    expect(projectPath('plugin', 'essentials')).toBe('/plugin/essentials')
  })

  it('straznik typu nie przepuszcza smieci', () => {
    expect(isProjectType('mod')).toBe(true)
    expect(isProjectType('plugin')).toBe(true)
    expect(isProjectType('datapack')).toBe(false)
    expect(isProjectType(null)).toBe(false)
    expect(isProjectType(['mod'])).toBe(false)
  })

  it('straznik kanalu wersji', () => {
    expect(isVersionChannel('beta')).toBe(true)
    expect(isVersionChannel('nightly')).toBe(false)
  })
})

describe('licencje', () => {
  it('lista ma 15 pozycji plus other', () => {
    expect(LICENSES).toHaveLength(16)
    expect(LICENSES.at(-1)).toBe('other')
  })

  it('straznik licencji', () => {
    expect(isLicense('MIT')).toBe(true)
    expect(isLicense('ARR')).toBe(true)
    expect(isLicense('WTFPL')).toBe(false)
  })
})

describe('przynaleznosc do listy wg loadera', () => {
  it('loadery modowe naleza do modow, pluginowe do pluginow', () => {
    expect(loadersForType('mod')).toEqual(
      expect.arrayContaining(['fabric', 'quilt', 'forge', 'neoforge']))
    expect(loadersForType('plugin')).toEqual(
      expect.arrayContaining(['bukkit', 'spigot', 'paper', 'purpur', 'folia',
        'sponge', 'bungeecord', 'velocity', 'waterfall']))
  })

  // Jar niosacy deskryptory obu swiatow ma sie znalezc na obu listach, bo
  // przynaleznosc wyprowadzamy z loaderow, a nie z jednej kolumny typu.
  it('loadery obu swiatow nie mieszaja sie ze soba', () => {
    for (const loader of ['fabric', 'forge']) {
      expect(loadersForType('plugin'), loader).not.toContain(loader)
    }
    for (const loader of ['paper', 'velocity']) {
      expect(loadersForType('mod'), loader).not.toContain(loader)
    }
  })

  it('kazdy typ ma przypisany co najmniej jeden loader', () => {
    for (const type of PROJECT_TYPES) {
      if (type === 'modpack') continue
      expect(loadersForType(type), type).not.toHaveLength(0)
    }
  })
})
