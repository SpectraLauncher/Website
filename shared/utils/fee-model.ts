
// What a payment costs us, so a rate can be judged before it is changed rather
// than after a month of sales.
//
// These are list prices, not a contract: Stripe's own rates move by country, by
// card type and by whatever was negotiated. They are inputs with defaults, and
// the defaults are a starting point to correct against a real invoice - which is
// why the answer always reports which numbers produced it.
export interface MethodCost {
  // Hundredths of a percent, same unit as the platform rate.
  rateBps: number
  fixedMinor: number
}

// To add a method: an entry here and a share in the mix.
export const METHOD_COSTS: Record<string, MethodCost> = {
  // Standard EEA consumer cards.
  card: { rateBps: 150, fixedMinor: 25 },
  // Cards issued outside the EEA cost noticeably more, and a Minecraft audience
  // is not a European one.
  cardInternational: { rateBps: 250, fixedMinor: 25 },
  paypal: { rateBps: 340, fixedMinor: 35 },
}

export interface SimulationInput {
  pricesMinor: number[]
  // Shares per method. Normalised, so 80/20 and 8/2 mean the same thing.
  mix: Record<string, number>
  rateBps: number
  minFeeMinor: number
}

export interface SimulationLine {
  method: string
  share: number
  volumeMinor: number
  platformFeeMinor: number
  stripeCostMinor: number
  marginMinor: number
}

export interface Simulation {
  lines: SimulationLine[]
  grossMinor: number
  platformFeeMinor: number
  stripeCostMinor: number
  marginMinor: number
  // Negative anywhere here is the rate failing to cover the processor on that
  // method - the thing this exists to catch.
  worstMethod: string | null
  effectiveRateBps: number
}

function feeFor(priceMinor: number, rateBps: number, minFeeMinor: number): number {
  if (priceMinor <= 0) return 0
  return Math.min(Math.max(Math.ceil((priceMinor * rateBps) / 10_000), minFeeMinor), priceMinor)
}

// Every price is run through every method, weighted by its share, rather than
// assigning whole sales to methods. A cheap item on an expensive method is
// exactly the case that loses money, and rounding sales into buckets would hide
// it behind an average.
export function simulate(input: SimulationInput): Simulation {
  const prices = input.pricesMinor.filter(price => Number.isFinite(price) && price > 0)
  const entries = Object.entries(input.mix)
    .filter(([method, share]) => METHOD_COSTS[method] && Number(share) > 0)

  const weight = entries.reduce((sum, [, share]) => sum + Number(share), 0)
  if (!prices.length || !weight) {
    return {
      lines: [],
      grossMinor: 0,
      platformFeeMinor: 0,
      stripeCostMinor: 0,
      marginMinor: 0,
      worstMethod: null,
      effectiveRateBps: 0,
    }
  }

  const lines = entries.map(([method, rawShare]) => {
    const share = Number(rawShare) / weight
    const cost = METHOD_COSTS[method]!

    let volumeMinor = 0
    let platformFeeMinor = 0
    let stripeCostMinor = 0

    for (const price of prices) {
      volumeMinor += price * share
      platformFeeMinor += feeFor(price, input.rateBps, input.minFeeMinor) * share
      stripeCostMinor += ((price * cost.rateBps) / 10_000 + cost.fixedMinor) * share
    }

    return {
      method,
      share,
      volumeMinor: Math.round(volumeMinor),
      platformFeeMinor: Math.round(platformFeeMinor),
      stripeCostMinor: Math.round(stripeCostMinor),
      marginMinor: Math.round(platformFeeMinor - stripeCostMinor),
    }
  })

  const grossMinor = lines.reduce((sum, line) => sum + line.volumeMinor, 0)
  const platformFeeMinor = lines.reduce((sum, line) => sum + line.platformFeeMinor, 0)
  const stripeCostMinor = lines.reduce((sum, line) => sum + line.stripeCostMinor, 0)

  const worst = lines.reduce<SimulationLine | null>(
    (low, line) => (!low || line.marginMinor < low.marginMinor ? line : low), null)

  return {
    lines,
    grossMinor,
    platformFeeMinor,
    stripeCostMinor,
    marginMinor: platformFeeMinor - stripeCostMinor,
    worstMethod: worst && worst.marginMinor < 0 ? worst.method : null,
    // What the platform actually keeps, against what the rate says it takes.
    // The gap is the floor doing its work on cheap items.
    effectiveRateBps: grossMinor ? Math.round((platformFeeMinor / grossMinor) * 10_000) : 0,
  }
}
