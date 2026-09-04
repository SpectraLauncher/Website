import { afterEach, describe, expect, it } from 'vitest'

import { catalogIsIndexable, catalogIsPublic } from '../../server/utils/catalog-gate'
import { runtimeConfig } from '../setup/globals'

afterEach(() => {
  runtimeConfig.catalogPublic = false
})

describe('flaga katalogu', () => {
  it('domyslnie zamknieta', () => {
    expect(catalogIsPublic()).toBe(false)
    expect(catalogIsIndexable()).toBe(false)
  })

  it('otwiera sie tylko na wartosci logicznej true', () => {
    runtimeConfig.catalogPublic = true
    expect(catalogIsPublic()).toBe(true)
    expect(catalogIsIndexable()).toBe(true)
  })

  // Nuxt potrafi oddac wartosc z NUXT_CATALOG_PUBLIC jako string, wiec 'true'
  // tez musi otwierac.
  it('przyjmuje takze string true', () => {
    runtimeConfig.catalogPublic = 'true'
    expect(catalogIsPublic()).toBe(true)
  })

  it('nie otwiera sie na przypadkowym stringu', () => {
    for (const value of ['false', '0', '', 'no', 1, {}]) {
      runtimeConfig.catalogPublic = value
      expect(catalogIsPublic(), String(value)).toBe(false)
    }
  })
})
