import { describe, expect, it } from 'vitest'

import { stripeCall } from '../../server/utils/stripe'

describe('bledy ze Stripe', () => {
  it('przepuszcza wynik, gdy nic sie nie stalo', async () => {
    await expect(stripeCall(async () => 'ok')).resolves.toBe('ok')
  })

  // The message names the exact thing to switch on, and it was the one line
  // being thrown away when this went out as an unhandled 500.
  it('zamienia blad konfiguracji na czytelna odpowiedz', async () => {
    const refusal = Object.assign(new Error(
      "You can only create new accounts if you've signed up for Connect."),
    { type: 'StripeInvalidRequestError' })

    await expect(stripeCall(async () => { throw refusal }))
      .rejects.toMatchObject({
        statusCode: 501,
        statusMessage: "You can only create new accounts if you've signed up for Connect.",
      })
  })

  it('nie przebiera przy bledach innego rodzaju', async () => {
    const network = Object.assign(new Error('connection reset'), { type: 'StripeConnectionError' })
    await expect(stripeCall(async () => { throw network })).rejects.toBe(network)
  })
})
