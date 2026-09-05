import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { limitFor, resetRateLimits, take } from '../../server/utils/rateLimit'

beforeEach(resetRateLimits)

// Jedno zadanie moze wywolac powiadomienie u wielu osob — odwolanie idzie do
// kazdego moderatora — wiec limit na trase nie jest ostatnim slowem o tym, ile
// poczty wychodzi. To jest sufit na jedna skrzynke.
describe('sufit na poczte do jednej osoby', () => {
  it('po dwudziestu listach w godzinie przestaje przepuszczac', () => {
    for (let i = 0; i < 20; i++) {
      expect(take('mail:u1', 20, 3_600_000).allowed, `list ${i + 1}`).toBe(true)
    }
    expect(take('mail:u1', 20, 3_600_000).allowed).toBe(false)
  })

  it('licznik jednej osoby nie blokuje drugiej', () => {
    for (let i = 0; i < 20; i++) take('mail:u1', 20, 3_600_000)
    expect(take('mail:u2', 20, 3_600_000).allowed).toBe(true)
  })

  it('wysylka faktycznie o niego pyta', () => {
    const source = readFileSync('server/utils/notify-mail.ts', 'utf8')
    expect(source).toContain('take(`mail:${userId}`')
    // Sufit musi byc sprawdzony po preferencjach, ale przed wyslaniem.
    expect(source.indexOf('take(`mail:')).toBeLessThan(source.indexOf('sendMail('))
  })
})

describe('trasy rozsylajace maja wlasny budzet', () => {
  it('odwolanie i zgloszenie sa limitowane per konto', () => {
    const thread = readFileSync('server/api/catalog/project/[slug]/thread.post.ts', 'utf8')
    const submit = readFileSync('server/api/catalog/project/[slug]/submit.post.ts', 'utf8')

    expect(thread).toContain('key: `thread:${user.id}`')
    expect(submit).toContain('key: `submit:${user.id}`')
  })
})

describe('kazdy prefiks API ma sufit na IP', () => {
  it.each([
    ['/api/org/abc/members/u1', 'org'],
    ['/api/me/notifications', 'me'],
    ['/api/notifications', 'notifications'],
    ['/api/catalog/project/x/thread', 'catalog'],
  ])('%s trafia do kubelka %s', (path, name) => {
    expect(limitFor(path, 'POST')?.name).toBe(name)
  })

  // Trasa uwierzytelniona bez limitu to nadal trasa bez limitu.
  it('zaden z tych prefiksow nie zostaje bez reguly', () => {
    for (const path of ['/api/org/x', '/api/me/x', '/api/catalog/x']) {
      expect(limitFor(path, 'POST'), path).not.toBeNull()
    }
  })
})
