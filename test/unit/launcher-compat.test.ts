import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { limitFor } from '../../server/utils/rateLimit'
import { TOKEN_PREFIX } from '../../shared/utils/token-scopes'

// Launcher jest osobnym programem, ktory nie aktualizuje sie razem ze strona.
// Kazda zmiana w tych trasach musi byc wsteczna, bo w terenie chodzi stara
// wersja i bedzie chodzic dlugo.
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
  // Launcher odpytuje co 30 sekund, wiec jedna osoba to dwa zadania na minute.
  // Budzet jest na adres, a akademik albo operator z CGNAT przychodzi jako
  // jeden adres.
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

  // Odpowiedz dostala nowe pole `project`. Doklada sie, nie zmienia — stary
  // launcher czyta swoje pola i ignoruje reszte.
  it('ksztalt powiadomienia zachowuje stare pola', () => {
    const source = readFileSync('server/api/notifications.get.ts', 'utf8')
    for (const field of ['id:', 'kind:', 'shareCode:', 'data:', 'read:', 'created:', 'actor:']) {
      expect(source, field).toContain(field)
    }
  })

  // Launcher wysyla token sesji better-auth w naglowku Bearer. Gdyby czytnik
  // tokenow API brał kazdy Bearer, przejalby jego uwierzytelnienie.
  it('token API nie przechwytuje sesji launchera', () => {
    const source = readFileSync('server/utils/tokens.ts', 'utf8')
    expect(source).toContain('startsWith(TOKEN_PREFIX)')
    expect(TOKEN_PREFIX).toBe('spx_')
  })

  it.each(LAUNCHER_PATHS)('%s ma regule limitu, ktora go nie dusi', (path) => {
    const rule = limitFor(path, 'GET')
    // Brak reguly tez jest w porzadku — znaczy bez limitu na adres.
    if (rule) expect(rule.limit).toBeGreaterThanOrEqual(30)
  })
})
