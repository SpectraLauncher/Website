
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

export const CURRENCIES = ['eur', 'usd'] as const
export type Currency = typeof CURRENCIES[number]

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(String(value).toLowerCase() as Currency)
}

// Stripe rejects a charge under its own floor, and the fee on anything at that
// end is rounding noise anyway. Both currencies use the same figure.
export const MIN_PRICE_MINOR = 100
export const MAX_PRICE_MINOR = 100_000
