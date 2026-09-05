import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_LIMITS,
  ACCOUNT_LIMIT_KEYS,
  atLimit,
  isAccountLimit,
} from '../../shared/utils/account-limits'

describe('rejestr limitow', () => {
  it('kazdy limit jest dodatnia liczba', () => {
    for (const key of ACCOUNT_LIMIT_KEYS) {
      expect(ACCOUNT_LIMITS[key], key).toBeGreaterThan(0)
      expect(Number.isInteger(ACCOUNT_LIMITS[key]), key).toBe(true)
    }
  })

  it('przyjmuje tylko znane nazwy', () => {
    for (const key of ACCOUNT_LIMIT_KEYS) expect(isAccountLimit(key)).toBe(true)
    for (const bad of ['', 'wat', null, 42]) expect(isAccountLimit(bad), String(bad)).toBe(false)
  })
})

describe('atLimit', () => {
  it('blokuje dopiero po osiagnieciu sufitu', () => {
    expect(atLimit({ current: 0, max: 3 })).toBe(false)
    expect(atLimit({ current: 2, max: 3 })).toBe(false)
    expect(atLimit({ current: 3, max: 3 })).toBe(true)
    expect(atLimit({ current: 9, max: 3 })).toBe(true)
  })

  it('brak stanu nie blokuje', () => {
    expect(atLimit(undefined)).toBe(false)
  })
})

// Limit czestotliwosci mowi, jak szybko cos powstaje. Ten mowi, ile moze
// istniec. Bez drugiego konto tworzy w nieskonczonosc, tylko wolniej.
describe('limity sa egzekwowane tam, gdzie rzeczy powstaja', () => {
  it.each([
    ['server/api/catalog/collections.post.ts', "requireHeadroom(user.id, 'collections')"],
    ['server/api/admin/catalog/projects.post.ts', "requireHeadroom(admin.id, 'projects')"],
    ['server/api/admin/catalog/projects/[id]/versions.post.ts', "'versionsPerProject'"],
  ])('%s pyta o miejsce', (file, needle) => {
    expect(readFileSync(file, 'utf8')).toContain(needle)
  })

  it('zakladanie organizacji przechodzi przez limit', () => {
    const source = readFileSync('server/utils/auth.ts', 'utf8')
    expect(source).toContain("limitState(user.id, 'organizations')")
    expect(source).toContain('state.current < state.max')
  })

  // Projekt organizacji obciaza organizacje, nie kazdego jej czlonka z osobna.
  it('projekt organizacji nie liczy sie do limitu osoby', () => {
    const source = readFileSync('server/api/admin/catalog/projects.post.ts', 'utf8')
    expect(source).toContain('if (!body.orgId)')
  })

  it('polka ulubionych nie zjada limitu kolekcji', () => {
    const source = readFileSync('server/utils/account-limits.ts', 'utf8')
    expect(source).toContain("kind <> 'favourites'")
  })
})
