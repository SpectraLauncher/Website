import { afterEach, describe, expect, it } from 'vitest'

import { catalogIsIndexable, catalogIsPublic } from '../../server/utils/catalog-gate'
import { runtimeConfig } from '../setup/globals'

afterEach(() => {
  (runtimeConfig.public as Record<string, unknown>).catalogPublic = false
})

describe('flaga katalogu', () => {
  it('domyslnie zamknieta', () => {
    expect(catalogIsPublic()).toBe(false)
    expect(catalogIsIndexable()).toBe(false)
  })

  it('otwiera sie tylko na wartosci logicznej true', () => {
    (runtimeConfig.public as Record<string, unknown>).catalogPublic = true
    expect(catalogIsPublic()).toBe(true)
    expect(catalogIsIndexable()).toBe(true)
  })

  // Nuxt can hand back the NUXT_PUBLIC_CATALOG_PUBLIC value as a string, so 'true' has
  // to open it too.
  it('przyjmuje takze string true', () => {
    (runtimeConfig.public as Record<string, unknown>).catalogPublic = 'true'
    expect(catalogIsPublic()).toBe(true)
  })

  it('nie otwiera sie na przypadkowym stringu', () => {
    for (const value of ['false', '0', '', 'no', 1, {}]) {
      (runtimeConfig.public as Record<string, unknown>).catalogPublic = value
      expect(catalogIsPublic(), String(value)).toBe(false)
    }
  })
})
