import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const checkout = readFileSync('server/api/catalog/checkout.post.ts', 'utf8')
const util = readFileSync('server/utils/checkout.ts', 'utf8')
const hook = readFileSync('server/api/hooks/stripe.post.ts', 'utf8')
const events = readFileSync('server/utils/stripe-events.ts', 'utf8')

describe('zgoda na natychmiastowa dostawe', () => {
  // An EU buyer keeps the right to withdraw from a digital purchase unless they
  // waive it before delivery. No waiver, no payment.
  it('brak zgody zatrzymuje platnosc, zanim sie zacznie', () => {
    expect(checkout).toContain('body.consent !== true')
    expect(checkout.indexOf('body.consent !== true'))
      .toBeLessThan(checkout.indexOf('paymentIntents.create'))
  })

  it('moment i tresc zgody ida do zamowienia', () => {
    expect(util).toContain('CONSENT_TERMS')
    expect(util).toContain('consent_at')
  })
})

describe('kolejnosc zapisu przy checkoucie', () => {
  // The other way round leaves a window where Stripe holds a charge nothing
  // here records, which is the one failure that costs somebody money.
  it('zamowienie powstaje przed intentem', () => {
    expect(checkout.indexOf('openSale(')).toBeLessThan(checkout.indexOf('paymentIntents.create'))
  })

  it('intent niesie id zamowienia, zeby webhook trafil do domu', () => {
    expect(checkout).toContain('metadata: { saleId')
    expect(events).toContain('intent.metadata?.saleId')
  })

  // Prices are never taken from the browser: the cart endpoint and the checkout
  // run the same function over the same rules.
  it('ceny licza sie na serwerze, nie przychodza z przegladarki', () => {
    expect(checkout).toContain('priceCart(user, body.items')
    expect(checkout).not.toMatch(/body\.(total|amount|price)/)
  })
})

describe('webhook', () => {
  it('zapisuje zdarzenie, zanim cokolwiek zrobi', () => {
    expect(hook.indexOf('recordEvent(')).toBeLessThan(hook.indexOf('handleStripeEvent('))
  })

  // Stopping at "we have seen this id" would strand every event that failed
  // halfway - which is exactly the one Stripe redelivers.
  it('pomija tylko to, co naprawde zostalo przetworzone', () => {
    expect(hook).toContain('await wasProcessed(parsed.id)')
  })

  it('bez sekretu nie przyjmuje niczego', () => {
    expect(hook).toContain('statusCode: 404')
    expect(hook.indexOf('constructEvent')).toBeGreaterThan(hook.indexOf('stripeWebhookSecret()'))
  })

  it('nieudane zdarzenie konczy sie bledem, zeby Stripe ponowil', () => {
    expect(hook).toContain('markFailed(')
    expect(hook).toContain('statusCode: 500')
  })
})

describe('dostawa nie czeka na karencje', () => {
  // The buyer paid; the holding period is about the seller's money, not the
  // buyer's download.
  it('uprawnienie powstaje przy platnosci, przed transferem', () => {
    expect(events.indexOf('grantEntitlement(')).toBeLessThan(events.indexOf(`enqueue('transfer'`))
  })

  it('transfer idzie w kolejke z opoznieniem, nie od razu', () => {
    expect(events).toContain('graceDays * DAY_MS')
  })
})
