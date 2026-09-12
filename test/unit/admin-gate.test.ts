import { describe, expect, it } from 'vitest'

import { bootstrapAdminEmails, isAdminEmail, parseAdminEmails } from '../../server/utils/admin'
import { isAdmin } from '../../shared/utils/staff-roles'

// Deliberately duplicates part of test/admin-gate-check.mjs: this is the smoke
// test for the whole vitest harness — importing from server/utils, the
// auto-import shim, useRuntimeConfig. If this file passes, every later server
// test will at least run.
describe('brama admina', () => {
  it('otwiera sie na roli, nie na adresie', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true)
    // owner stoi nad adminem, wiec przechodzi te same bramy
    expect(isAdmin({ role: 'owner' })).toBe(true)
    // moderator stoi nizej: moderuje katalog i nie siega po reszte panelu
    expect(isAdmin({ role: 'moderator' })).toBe(false)
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
