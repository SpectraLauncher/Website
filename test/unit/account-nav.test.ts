import { describe, expect, it } from 'vitest'

import { ACCOUNT_ENTRIES, accountEntries } from '../../app/utils/accountNav'

const ids = (viewer: Parameters<typeof accountEntries>[0]) =>
  accountEntries(viewer).map(entry => entry.id)

describe('nawigacja konta', () => {
  it('wylogowany nie dostaje nic', () => {
    expect(ids({ signedIn: false, username: 'makotopd', catalogVisible: true })).toEqual([])
  })

  it('konto bez username traci tylko wpis profilu', () => {
    const withName = ids({ signedIn: true, username: 'makotopd', catalogVisible: true })
    const without = ids({ signedIn: true, username: null, catalogVisible: true })

    expect(withName).toContain('profile')
    expect(without).not.toContain('profile')
    expect(without).toEqual(withName.filter(id => id !== 'profile'))
    expect(without).toContain('settings')
    expect(without.length).toBeGreaterThan(5)
  })

  it('zamkniety katalog zostawia to, co nie jest katalogiem', () => {
    expect(ids({ signedIn: true, username: 'makotopd', catalogVisible: false }))
      .toEqual(['profile', 'notifications', 'settings'])
  })

  it('adres profilu bierze sie z username', () => {
    const profile = accountEntries({ signedIn: true, username: 'makotopd', catalogVisible: true })
      .find(entry => entry.id === 'profile')

    expect(profile?.path).toBe('/u/makotopd')
  })

  it('kazdy wpis ma unikalne id i adres', () => {
    const all = accountEntries({ signedIn: true, username: 'x', catalogVisible: true })

    expect(new Set(all.map(e => e.id)).size).toBe(ACCOUNT_ENTRIES.length)
    expect(new Set(all.map(e => e.path)).size).toBe(ACCOUNT_ENTRIES.length)
  })
})
