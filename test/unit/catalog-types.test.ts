import { describe, expect, it } from 'vitest'

import {
  LICENSES,
  PROJECT_TYPES,
  TYPE_PREFIX,
  isLicense,
  isProjectType,
  isVersionChannel,
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
