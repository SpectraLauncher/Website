import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// The policy is built at run time from runtime config, so it is read as source
// here. A CSP mistake does not throw - the browser silently refuses to load the
// thing, and the onboarding form just never appears.
const source = readFileSync('server/middleware/security-headers.ts', 'utf8')

const directive = (name: string) => {
  const line = source.split('\n').find(l => l.includes(`\`${name} `))
  return line ?? ''
}

describe('CSP dla komponentow Connect', () => {
  it('pozwala zaladowac Connect.js', () => {
    expect(directive('script-src')).toContain('${STRIPE}')
    expect(source).toContain('https://connect-js.stripe.com')
    expect(source).toContain('https://js.stripe.com')
  })

  // The components render themselves inside Stripe-owned iframes.
  it('pozwala osadzic ramki Stripe', () => {
    expect(directive('frame-src')).toContain('${STRIPE}')
  })

  it('nie gubi Turnstile przy okazji', () => {
    expect(directive('script-src')).toContain('${TURNSTILE}')
    expect(directive('frame-src')).toContain('${TURNSTILE}')
  })

  // Stripe documents a style-src hash for an empty style element. Adding it
  // would be actively harmful: a browser ignores 'unsafe-inline' for any
  // directive that also carries a hash, so every inline style on the site would
  // stop working to permit one of Stripe's.
  it('nie dokłada hasha do style-src, bo unieważniłby unsafe-inline', () => {
    expect(directive('style-src')).toContain(`'unsafe-inline'`)
    expect(directive('style-src')).not.toContain('sha256-')
  })

  // same-origin here breaks the sign-in popup that onboarding opens.
  it('nie ustawia Cross-Origin-Opener-Policy', () => {
    expect(source.toLowerCase()).not.toContain('cross-origin-opener-policy\':')
    expect(source).not.toContain(`'cross-origin-opener-policy'`)
  })

  it('obrazy i tak sa dozwolone z kazdego https', () => {
    expect(directive('img-src')).toContain('https:')
  })
})
