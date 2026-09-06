import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { relyingPartyId, siteOrigin } = await import('../../server/utils/auth')

const original = process.env.NUXT_PUBLIC_SITE_URL
afterEach(() => { process.env.NUXT_PUBLIC_SITE_URL = original })

describe('relyingPartyId', () => {
  it('bierze sam host, bez schematu i portu', () => {
    process.env.NUXT_PUBLIC_SITE_URL = 'https://usespectra.app'
    expect(relyingPartyId()).toBe('usespectra.app')

    process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    expect(relyingPartyId()).toBe('localhost')
  })

  it('sciezka i zapytanie nie wchodza do identyfikatora', () => {
    process.env.NUXT_PUBLIC_SITE_URL = 'https://usespectra.app/a/b?c=1'
    expect(relyingPartyId()).toBe('usespectra.app')
  })

  // A key is bound to the domain. Quietly falling back to another value would
  // invalidate everyone's, so a bad setting has to stop the boot.
  it('krzyczy zamiast zgadywac, gdy adres nie jest adresem', () => {
    process.env.NUXT_PUBLIC_SITE_URL = 'usespectra.app'
    expect(() => relyingPartyId()).toThrow(/NUXT_PUBLIC_SITE_URL/)
  })

  it('bez zmiennej srodowiskowej ma sensowna wartosc', () => {
    delete process.env.NUXT_PUBLIC_SITE_URL
    expect(siteOrigin()).toMatch(/^https?:\/\//)
    expect(() => relyingPartyId()).not.toThrow()
  })
})
