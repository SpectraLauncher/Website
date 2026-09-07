
import Stripe from 'stripe'

let client: Stripe | null = null

export function useStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!client) client = new Stripe(key)
  return client
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

export function requireStripe(): Stripe {
  const stripe = useStripe()
  if (!stripe) throw createError({ statusCode: 501, statusMessage: 'payments are not configured' })
  return stripe
}

// Every route validates its input before it reaches Stripe, so an "invalid
// request" coming back is about the platform account rather than about what
// somebody typed: Connect not switched on, a key from the wrong mode, a
// capability never requested. Left unhandled it surfaces as a bare 500, which
// tells the person clicking nothing and hides the one line that says what to
// go and enable.
export async function stripeCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  }
  catch (e) {
    const failure = e as { type?: string, message?: string }
    if (failure?.type !== 'StripeInvalidRequestError') throw e

    throw createError({
      statusCode: 501,
      statusMessage: failure.message || 'payments are not set up',
    })
  }
}
