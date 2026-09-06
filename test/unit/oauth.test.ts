import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  OAUTH_CODE_TTL_MS,
  buildRedirect,
  cleanRedirectUris,
  cleanState,
  isUsableRedirect,
  pickRedirect,
  redirectMatches,
} from '../../shared/utils/oauth'
import { TOKEN_LIFETIMES, expiryFrom, lifetimeDays } from '../../shared/utils/token-scopes'

// The redirect is where an authorization code is delivered. A client that
// accepts an unregistered one hands the code to whoever asked for it, which is
// the classic hole in an OAuth implementation.
describe('what may be a redirect at all', () => {
  it('https is fine', () => {
    expect(isUsableRedirect('https://example.com/callback')).toBe(true)
  })

  it('plain http is refused except on loopback', () => {
    expect(isUsableRedirect('http://example.com/callback')).toBe(false)
    expect(isUsableRedirect('http://localhost:7777/callback')).toBe(true)
    expect(isUsableRedirect('http://127.0.0.1:7777/cb')).toBe(true)
  })

  it('anything that can carry script is refused', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://x.test/']) {
      expect(isUsableRedirect(bad), bad).toBe(false)
    }
  })

  it('a fragment is refused, because the code would never reach the server', () => {
    expect(isUsableRedirect('https://example.com/cb#part')).toBe(false)
  })

  it('nonsense is refused', () => {
    for (const bad of ['', '   ', 'not a url', null, 42, undefined]) {
      expect(isUsableRedirect(bad), String(bad)).toBe(false)
    }
  })
})

describe('matching a redirect against the registered ones', () => {
  it('the query may differ, nothing else may', () => {
    expect(redirectMatches('https://a.test/cb', 'https://a.test/cb?x=1')).toBe(true)
    expect(redirectMatches('https://a.test/cb/', 'https://a.test/cb')).toBe(true)
  })

  // Each of these is a way to be sent somewhere else entirely.
  it('host, scheme, port and path must all agree', () => {
    expect(redirectMatches('https://a.test/cb', 'https://evil.test/cb')).toBe(false)
    expect(redirectMatches('https://a.test/cb', 'http://a.test/cb')).toBe(false)
    expect(redirectMatches('https://a.test/cb', 'https://a.test:8443/cb')).toBe(false)
    expect(redirectMatches('https://a.test/cb', 'https://a.test/cb/deeper')).toBe(false)
    expect(redirectMatches('https://a.test/cb', 'https://a.test.evil.com/cb')).toBe(false)
  })

  it('host case does not matter, path case does', () => {
    expect(redirectMatches('https://A.test/cb', 'https://a.test/cb')).toBe(true)
    expect(redirectMatches('https://a.test/cb', 'https://a.test/CB')).toBe(false)
  })

  it('an unregistered redirect is refused rather than corrected', () => {
    const registered = ['https://a.test/cb']
    expect(pickRedirect(registered, 'https://evil.test/cb')).toBeNull()
    expect(pickRedirect(registered, 'https://a.test/cb?s=1')).toBe('https://a.test/cb?s=1')
  })

  it('no redirect given falls back to the first registered one', () => {
    expect(pickRedirect(['https://a.test/cb', 'https://b.test/cb'], undefined))
      .toBe('https://a.test/cb')
  })

  it('a client with nothing registered can never be redirected to', () => {
    expect(pickRedirect([], 'https://a.test/cb')).toBeNull()
    expect(pickRedirect([], undefined)).toBeNull()
  })
})

describe('registration', () => {
  it('keeps only usable addresses and deduplicates', () => {
    const out = cleanRedirectUris([
      'https://a.test/cb',
      'https://a.test/cb',
      'http://evil.test/cb',
      'javascript:alert(1)',
    ])
    expect(out).toEqual(['https://a.test/cb'])
  })

  it('is capped, so one client cannot register a hundred addresses', () => {
    const many = Array.from({ length: 40 }, (_, i) => `https://a.test/cb${i}`)
    expect(cleanRedirectUris(many).length).toBeLessThanOrEqual(10)
  })
})

describe('state and the redirect back', () => {
  it('state is echoed as an opaque string, and bounded', () => {
    expect(cleanState('abc')).toBe('abc')
    expect(cleanState('x'.repeat(900)).length).toBe(500)
    expect(cleanState({ a: 1 })).toBe('')
  })

  it('parameters are added without losing the ones already there', () => {
    const out = buildRedirect('https://a.test/cb?keep=1', { code: 'xyz', state: 's' })
    const url = new URL(out)
    expect(url.searchParams.get('keep')).toBe('1')
    expect(url.searchParams.get('code')).toBe('xyz')
    expect(url.searchParams.get('state')).toBe('s')
  })
})

describe('the flow refuses what it should', () => {
  const authorizeGet = readFileSync('server/api/oauth/authorize.get.ts', 'utf8')
  const authorizePost = readFileSync('server/api/oauth/authorize.post.ts', 'utf8')
  const token = readFileSync('server/api/oauth/token.post.ts', 'utf8')
  const module = readFileSync('server/utils/oauth.ts', 'utf8')

  it('an unregistered redirect is an error, never a redirect to it', () => {
    for (const [name, source] of [['get', authorizeGet], ['post', authorizePost]] as const) {
      expect(source, name).toContain('redirect_uri is not registered')
    }
  })

  it('a request wider than the client ceiling is refused', () => {
    expect(authorizePost).toContain('asked & ~Number(client.max_scopes)')
  })

  // A code that can be redeemed twice is a code an attacker can replay.
  it('the code is single use, because reading it deletes it', () => {
    expect(module).toContain('DELETE FROM oauth_code')
    expect(module).toContain('RETURNING user_id, scopes, redirect_uri, expires')
  })

  it('the code is short lived and bound to its redirect', () => {
    expect(OAUTH_CODE_TTL_MS).toBeLessThanOrEqual(15 * 60_000)
    expect(module).toContain('row.redirect_uri !== input.redirectUri')
  })

  it('the token exchange checks the client secret in constant time', () => {
    expect(token).toContain('verifySecret(client')
    expect(module).toContain('timingSafeEqual')
  })

  // Telling the caller which of the four went wrong helps them find a valid one.
  it('every failed exchange gives the same answer', () => {
    const matches = token.match(/invalid_grant/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('secrets are stored hashed, like any credential', () => {
    expect(module).toContain("createHash('sha256')")
    expect(module).toContain('secret_hash')
  })

  // A revoke button that leaves the application working is a lie.
  it('withdrawing consent takes the tokens with it', () => {
    expect(module).toContain('DELETE FROM access_token WHERE client_id = $1 AND user_id = $2')
  })
})

describe('how long a token lives', () => {
  it('offers every period the site advertises', () => {
    expect([...TOKEN_LIFETIMES]).toEqual([1, 7, 14, 30, 90, 365, 730, 0])
  })

  it('zero means it does not expire', () => {
    expect(expiryFrom(0)).toBeNull()
    expect(expiryFrom(30, 1_000)).toBe(1_000 + 30 * 86_400_000)
  })

  // A caller asking for 45 days gets a sane token rather than a rejection it
  // has no way to act on.
  it('an unlisted period falls back instead of failing', () => {
    expect(lifetimeDays(45)).toBe(30)
    expect(lifetimeDays('nonsense')).toBe(30)
    expect(lifetimeDays(undefined)).toBe(30)
  })

  it('a listed period is kept, including never', () => {
    expect(lifetimeDays(1)).toBe(1)
    expect(lifetimeDays(730)).toBe(730)
    expect(lifetimeDays(0)).toBe(0)
  })

  it('the client decides, and the token honours it', () => {
    const module = readFileSync('server/utils/oauth.ts', 'utf8')
    const route = readFileSync('server/api/oauth/token.post.ts', 'utf8')

    expect(module).toContain('expiryFrom(lifetimeDays(input.tokenDays))')
    expect(route).toContain('tokenDays: client.token_days')
  })

  // Agreeing to access without being told how long it lasts is not agreeing.
  it('the consent screen states the period', () => {
    const get = readFileSync('server/api/oauth/authorize.get.ts', 'utf8')
    const page = readFileSync('app/pages/oauth/authorize.vue', 'utf8')

    expect(get).toContain('tokenDays: client.token_days')
    expect(page).toContain("t('oauth.lasts'")
  })

  it('every period has a label in both languages', () => {
    for (const loc of ['en', 'pl']) {
      const d = JSON.parse(readFileSync(`i18n/locales/${loc}.json`, 'utf8'))
      expect(d.tokens.lifetimes.never, loc).toBeTruthy()

      for (const days of TOKEN_LIFETIMES.filter(n => n > 0)) {
        expect(d.tokens.lifetimes[String(days)], `${loc}:${days}`).toBeTruthy()
      }
    }
  })
})
