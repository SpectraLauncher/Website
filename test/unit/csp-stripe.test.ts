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

  // Not in Stripe's documented list, and found only by loading the page:
  // Connect.js fetches its own source map from the top-level context, which this
  // directive governs, so leaving it out logs a violation on every visit.
  it('pozwala Connect.js siegnac po wlasna source mape', () => {
    expect(directive('connect-src')).toContain('${STRIPE}')
  })

  it('nie gubi Turnstile przy okazji', () => {
    expect(directive('script-src')).toContain('${TURNSTILE}')
    expect(directive('frame-src')).toContain('${TURNSTILE}')
    expect(directive('connect-src')).toContain('${TURNSTILE}')
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

  // payment=() switches off the Payment Request API, which is what Google Pay
  // and Apple Pay inside the Payment Element are. The buttons then never appear
  // and the console says only that payment is not allowed.
  // The header itself, not the file: the comment above it names the old value to
  // explain why it changed, and matching on the whole source would read that
  // explanation as the setting.
  const permissions = source.slice(
    source.indexOf(`'permissions-policy':`),
    source.indexOf(`'content-security-policy'`),
  )

  it('nie wylacza Payment Request API, ktorego uzywaja portfele', () => {
    expect(permissions).toContain('payment=(self "https://js.stripe.com")')
    expect(permissions).not.toMatch(/payment=\(\)/)
  })

  it('nadal wylacza kamere, mikrofon i lokalizacje', () => {
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()']) {
      expect(permissions, feature).toContain(feature)
    }
  })

  it('obrazy i tak sa dozwolone z kazdego https', () => {
    expect(directive('img-src')).toContain('https:')
  })
})
