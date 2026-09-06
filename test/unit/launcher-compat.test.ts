import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { limitFor } from '../../server/utils/rateLimit'
import { TOKEN_PREFIX } from '../../shared/utils/token-scopes'

// The launcher is a separate program that does not update with the site, so a
// change to these routes has to stay backward compatible: an old build is in the
// field and will be for a long time.
const LAUNCHER_PATHS = [
  '/api/notifications',
  '/api/notifications/read',
  '/api/notifications/12',
  '/api/friends',
  '/api/users',
  '/api/shares',
  '/api/telemetry',
]

describe('launcher dalej dziala', () => {
  // The launcher polls every thirty seconds, so one person costs two requests a
  // minute. The budget is per address, and a dorm or an ISP doing carrier-grade
  // NAT arrives as one address.
  it('limit powiadomien miesci setki osob za jednym adresem', () => {
    const rule = limitFor('/api/notifications', 'GET')
    expect(rule).not.toBeNull()

    const perUserPerMinute = 2
    expect(rule!.limit / perUserPerMinute).toBeGreaterThanOrEqual(300)
  })

  it('zadna trasa launchera nie zniknela z serwera', () => {
    const routes = [
      'server/api/notifications.get.ts',
      'server/api/notifications/read.post.ts',
      'server/api/notifications/[id].delete.ts',
      'server/api/friends.get.ts',
      'server/api/users.get.ts',
    ]

    for (const route of routes) {
      expect(() => readFileSync(route, 'utf8'), route).not.toThrow()
    }
  })

  it('trasy launchera nie trafily za flage katalogu', () => {
    for (const route of [
      'server/api/notifications.get.ts',
      'server/api/notifications/read.post.ts',
    ]) {
      const source = readFileSync(route, 'utf8')
      expect(source, route).not.toContain('requireCatalogRead')
      expect(source, route).not.toContain('requireAdmin')
    }
  })

  // The response gained a `project` field. Adding is safe: an old launcher
  // reads its own fields and ignores the rest.
  it('ksztalt powiadomienia zachowuje stare pola', () => {
    const source = readFileSync('server/api/notifications.get.ts', 'utf8')
    for (const field of ['id:', 'kind:', 'shareCode:', 'data:', 'read:', 'created:', 'actor:']) {
      expect(source, field).toContain(field)
    }
  })

  // The launcher sends a better-auth session token as Bearer. If the API token
  // reader took every Bearer, it would hijack that.
  it('token API nie przechwytuje sesji launchera', () => {
    const source = readFileSync('server/utils/tokens.ts', 'utf8')
    expect(source).toContain('startsWith(TOKEN_PREFIX)')
    expect(TOKEN_PREFIX).toBe('spx_')
  })

  it.each(LAUNCHER_PATHS)('%s ma regule limitu, ktora go nie dusi', (path) => {
    const rule = limitFor(path, 'GET')
    // No rule is fine too; it means no per-address budget.
    if (rule) expect(rule.limit).toBeGreaterThanOrEqual(30)
  })
})
