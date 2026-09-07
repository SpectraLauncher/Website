import { describe, expect, it } from 'vitest'

import { METHOD_COSTS, simulate } from '../../shared/utils/fee-model'

const base = { rateBps: 800, minFeeMinor: 50 }

describe('symulacja oplacalnosci stawki', () => {
  it('na samych kartach 8 procent pokrywa koszt z zapasem', () => {
    const out = simulate({ ...base, pricesMinor: [1000], mix: { card: 1 } })

    // 8% of 10 EUR is 80 cents; the card costs 1.5% + 25 = 40.
    expect(out.platformFeeMinor).toBe(80)
    expect(out.stripeCostMinor).toBe(40)
    expect(out.marginMinor).toBe(40)
    expect(out.worstMethod).toBeNull()
  })

  // The case the floor exists for, and the reason it is not enough on its own.
  it('najtansza pozycja przez PayPala jest stratna', () => {
    const out = simulate({ ...base, pricesMinor: [300], mix: { paypal: 1 } })

    // The floor gives 50 cents; PayPal takes 3.4% + 35 = about 45.
    expect(out.platformFeeMinor).toBe(50)
    expect(out.stripeCostMinor).toBeGreaterThan(40)
    expect(out.marginMinor).toBeLessThan(10)
  })

  it('wskazuje metode, ktora nie wychodzi na zero', () => {
    const out = simulate({
      pricesMinor: [300],
      mix: { paypal: 1 },
      rateBps: 800,
      minFeeMinor: 20,
    })

    expect(out.marginMinor).toBeLessThan(0)
    expect(out.worstMethod).toBe('paypal')
  })

  it('miks wazy sie udzialami, nie kolejnoscia', () => {
    const half = simulate({ ...base, pricesMinor: [1000], mix: { card: 1, paypal: 1 } })
    const same = simulate({ ...base, pricesMinor: [1000], mix: { card: 5, paypal: 5 } })

    expect(half.marginMinor).toBe(same.marginMinor)
  })

  it('sumy skladaja sie z linii', () => {
    const out = simulate({ ...base, pricesMinor: [500, 2000], mix: { card: 0.8, paypal: 0.2 } })

    expect(out.platformFeeMinor)
      .toBe(out.lines.reduce((sum, line) => sum + line.platformFeeMinor, 0))
    expect(out.marginMinor).toBe(out.platformFeeMinor - out.stripeCostMinor)
  })

  // The rate says 8%; the floor pushes cheap items above it. Knowing the gap is
  // the point of running this at all.
  it('stawka efektywna rosnie ponad nominalna przy tanich pozycjach', () => {
    const cheap = simulate({ ...base, pricesMinor: [300, 300, 300], mix: { card: 1 } })
    const dear = simulate({ ...base, pricesMinor: [5000], mix: { card: 1 } })

    expect(cheap.effectiveRateBps).toBeGreaterThan(800)
    expect(dear.effectiveRateBps).toBe(800)
  })

  it('brak cen albo pustka w miksie daje zera, nie NaN', () => {
    for (const out of [
      simulate({ ...base, pricesMinor: [], mix: { card: 1 } }),
      simulate({ ...base, pricesMinor: [1000], mix: {} }),
      simulate({ ...base, pricesMinor: [1000], mix: { nieistniejaca: 1 } }),
    ]) {
      expect(out.marginMinor).toBe(0)
      expect(Number.isNaN(out.effectiveRateBps)).toBe(false)
    }
  })

  it('kazda metoda ma stawke i kwote stala', () => {
    for (const [name, cost] of Object.entries(METHOD_COSTS)) {
      expect(cost.rateBps, name).toBeGreaterThan(0)
      expect(cost.fixedMinor, name).toBeGreaterThanOrEqual(0)
    }
  })
})
