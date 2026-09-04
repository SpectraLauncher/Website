import { describe, expect, it } from 'vitest'

import { bootstrapAdminEmails, isAdmin, isAdminEmail, parseAdminEmails } from '../../server/utils/admin'

// Dubluje czesc test/admin-gate-check.mjs celowo: to jest smoke test calego
// harnessu vitest — import z server/utils, shim auto-importow, useRuntimeConfig.
// Jesli ten plik przechodzi, kazdy nastepny test serwerowy tez sie uruchomi.
describe('brama admina', () => {
  it('otwiera sie na roli, nie na adresie', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true)
    expect(isAdmin({ role: 'user' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })

  it('czyta liste adresow z runtime configu', () => {
    expect(bootstrapAdminEmails()).toEqual(['patrydab4@gmail.com'])
  })

  it('normalizuje liste i nie daje sie podszyc', () => {
    const list = parseAdminEmails(' A@x.pl , b@Y.pl ,, ')
    expect(list).toEqual(['a@x.pl', 'b@y.pl'])
    expect(isAdminEmail('a@x.pl.evil.pl', list)).toBe(false)
  })
})
