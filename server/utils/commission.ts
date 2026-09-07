
import { one } from './db'

// The platform takes one cut per sale and it covers the payment processor too:
// the seller never sees a separate Stripe line, so the rate has to be wide
// enough to swallow Stripe's own fee and still leave something. What Stripe
// actually charges is a fixed part plus a percentage, which is why a flat
// percentage alone goes negative on cheap items and why there is a floor.
//
// Rates are basis points, not floats. 8% is 800, half a percent is 50, and
// nothing here ever multiplies money by a fraction.
export interface CommissionSettings {
  rateBps: number
  partnerRateBps: number
  minFeeMinor: number
  minPriceMinor: number
}

export const COMMISSION_DEFAULTS: CommissionSettings = {
  rateBps: 800,
  partnerRateBps: 600,
  minFeeMinor: 50,
  minPriceMinor: 300,
}

export const SETTING_KEY = 'commission'

// Every setting is one row of JSON rather than a column per knob, because the
// alternative is a migration every time a number needs to move and the whole
// point is changing these without a deploy.
export async function commissionSettings(): Promise<CommissionSettings> {
  const row = await one<{ value: Partial<CommissionSettings> }>(
    'SELECT value FROM platform_setting WHERE key = $1', [SETTING_KEY])

  return sanitizeSettings(row?.value)
}

// A bad row must not take payments down, and must never silently make the
// platform work for free: anything missing or nonsensical falls back to the
// default for that field alone.
export function sanitizeSettings(input: unknown): CommissionSettings {
  const raw = (input ?? {}) as Partial<Record<keyof CommissionSettings, unknown>>
  // Number(null), Number('') and Number(false) are all 0, so coercing first
  // would read a missing floor as "charge nothing" instead of as missing.
  const whole = (value: unknown, fallback: number, min: number) => {
    if (typeof value !== 'number' && typeof value !== 'string') return fallback
    if (typeof value === 'string' && value.trim() === '') return fallback

    const n = Math.floor(Number(value))
    return Number.isFinite(n) && n >= min ? n : fallback
  }

  return {
    rateBps: whole(raw.rateBps, COMMISSION_DEFAULTS.rateBps, 0),
    partnerRateBps: whole(raw.partnerRateBps, COMMISSION_DEFAULTS.partnerRateBps, 0),
    minFeeMinor: whole(raw.minFeeMinor, COMMISSION_DEFAULTS.minFeeMinor, 0),
    minPriceMinor: whole(raw.minPriceMinor, COMMISSION_DEFAULTS.minPriceMinor, 1),
  }
}

export interface SellerTerms {
  partner: boolean
  overrideBps: number | null
}

// An override on the seller wins over everything, which is how an individual
// arrangement is expressed without a second rate table. Null means "no
// arrangement", and zero is a real rate meaning the platform takes nothing —
// so the check is for null, never for falsiness.
export function rateBpsFor(settings: CommissionSettings, terms: SellerTerms): number {
  if (terms.overrideBps !== null && terms.overrideBps >= 0) return terms.overrideBps
  return terms.partner ? settings.partnerRateBps : settings.rateBps
}

// Rounded up, so the platform is never the one eating a fraction of a cent, and
// capped at the price, because a fee larger than what the buyer paid would put
// the seller in debt for making a sale.
export function feeFor(priceMinor: number, rateBps: number, minFeeMinor: number): number {
  if (priceMinor <= 0) return 0

  const percentage = Math.ceil((priceMinor * rateBps) / 10_000)
  return Math.min(Math.max(percentage, minFeeMinor), priceMinor)
}

export interface PricedItem {
  priceMinor: number
  seller: SellerTerms
}

export interface ChargedItem {
  priceMinor: number
  feeMinor: number
  netMinor: number
  rateBps: number
  minFeeMinor: number
}

// Per item, never over the cart total. A basket of one 30 EUR pack and one 3 EUR
// schematic charged as a lump would let the cheap item ride on the expensive
// one's fee, and the floor exists precisely so cheap items carry their own cost.
//
// The rate and the floor are returned with each line so the order can store what
// was applied. A historical order that reads today's configuration is a
// historical order that changes after the fact.
export function chargeItems(items: PricedItem[], settings: CommissionSettings): ChargedItem[] {
  return items.map((item) => {
    const rateBps = rateBpsFor(settings, item.seller)
    const feeMinor = feeFor(item.priceMinor, rateBps, settings.minFeeMinor)

    return {
      priceMinor: item.priceMinor,
      feeMinor,
      netMinor: item.priceMinor - feeMinor,
      rateBps,
      minFeeMinor: settings.minFeeMinor,
    }
  })
}

// Splitting whole cents between people whose shares are percentages leaves a
// remainder that has to land somewhere. Largest remainder: hand everyone their
// floor, then give the leftover cents one each to whoever was rounded down
// hardest. The result always sums to exactly the amount that came in.
export function splitMinorUnits(amountMinor: number, sharesBps: number[]): number[] {
  const total = sharesBps.reduce((sum, bps) => sum + bps, 0)
  if (!sharesBps.length || total <= 0 || amountMinor <= 0) return sharesBps.map(() => 0)

  const exact = sharesBps.map(bps => (amountMinor * bps) / total)
  const out = exact.map(value => Math.floor(value))

  let left = amountMinor - out.reduce((sum, value) => sum + value, 0)

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (let i = 0; left > 0; i++, left--) out[order[i % order.length]!.index]! += 1

  return out
}
