import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const checkout = readFileSync('server/api/catalog/checkout.post.ts', 'utf8')
const util = readFileSync('server/utils/checkout.ts', 'utf8')
const hook = readFileSync('server/api/hooks/stripe.post.ts', 'utf8')
const events = readFileSync('server/utils/stripe-events.ts', 'utf8')

describe('zakup bez konta', () => {
  // No account means no entitlement row to hang the files on, so the receipt
  // address is the only way back to them - which is why it is required rather
  // than collected if offered.
  it('gosc musi podac adres, zalogowany nie', () => {
    expect(checkout).toContain('viewer?.email ?? readEmail(body.email)')
    expect(checkout).toContain('a valid email is needed for the receipt')
  })

  it('zamowienie dostaje token, ktory jest calym poswiadczeniem goscia', () => {
    expect(util).toContain('accessToken')
    expect(util).toContain(`status = 'paid'`)
  })

  // Otherwise a token would open any project, not the ones that were bought.
  it('token otwiera tylko to, co bylo w tej sprzedazy', () => {
    const entitlement = readFileSync('server/utils/entitlement.ts', 'utf8')
    expect(entitlement).toContain('i.project_id = $2')
    expect(entitlement).toContain(`s.status = 'paid'`)
  })

  it('paragon wychodzi raz, z dostawy ktora ruszyla wiersz', () => {
    expect(events.indexOf('if (!moved) return')).toBeLessThan(events.indexOf('sendReceipt('))
  })
})

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
    expect(checkout).toContain('priceCart(viewer, body.items')
    expect(checkout).not.toMatch(/body\.(total|amount|price)/)
  })
})

describe('formularz platnosci', () => {
  const page = readFileSync('app/pages/cart.vue', 'utf8')

  // The container only exists once the form is showing. Mounting before the flag
  // hands Stripe a null, and it reports only "Missing argument".
  it('kontener istnieje, zanim Stripe sie w nim montuje', () => {
    expect(page.indexOf('paying.value = true')).toBeLessThan(page.indexOf('payment.mount('))
    expect(page).toContain('await nextTick()')
    expect(page.indexOf('await nextTick()')).toBeLessThan(page.indexOf('payment.mount('))
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

// Accounts v2 has its own event family, and whether the classic account.updated
// still fires for a v2 account is not something the documentation commits to.
describe('zmiany na koncie sprzedawcy', () => {
  it('przyjmuje obie rodziny zdarzen', () => {
    expect(events).toContain(`event.type === 'account.updated'`)
    expect(events).toContain(`event.type.startsWith('v2.core.account')`)
  })

  // A v1 event carries the object, a v2 one points at it through related_object.
  it('czyta identyfikator z obu ksztaltow ladunku', () => {
    expect(events).toContain('payload.data?.object?.id')
    expect(events).toContain('payload.related_object?.id')
  })

  // Nothing else is read from the payload, which is what makes a repeat
  // delivery harmless: the account is fetched fresh either way.
  it('i tak pyta Stripe o aktualny stan konta', () => {
    expect(events).toContain('refreshAccount(row)')
  })
})

// A guest has no library. Telling them their files are in one is worse than
// telling them nothing, and it was what the page said.
describe('co widzi kupujacy po zaplaceniu', () => {
  const page = readFileSync('app/pages/cart.vue', 'utf8')

  it('gosc nie jest odsylany do biblioteki', () => {
    expect(page).toContain(`signedIn ? t('cart.done') : t('cart.doneGuest')`)
    expect(page).toContain(`v-if="signedIn"`)
  })

  it('gosc dostaje link do swoich plikow od razu', () => {
    expect(page).toContain('orderToken')
    expect(checkout).toContain('accessToken,')
  })

  // Where a redirecting method comes back to. Sending a guest to the library
  // would strand them on a page that is not theirs.
  it('powrot po przekierowaniu zalezy od tego, kto kupuje', () => {
    expect(page).toContain('return_url: signedIn.value')
  })
})
