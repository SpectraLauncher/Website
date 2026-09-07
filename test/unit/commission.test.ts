import { describe, expect, it } from 'vitest'

import {
  COMMISSION_DEFAULTS,
  chargeItems,
  feeFor,
  rateBpsFor,
  sanitizeSettings,
  splitMinorUnits,
} from '../../server/utils/commission'

const settings = COMMISSION_DEFAULTS
const plain = { partner: false, overrideBps: null }
const partner = { partner: true, overrideBps: null }

describe('stawka', () => {
  it('domyslnie 8 procent, dla partnera 6', () => {
    expect(settings.rateBps).toBe(800)
    expect(settings.partnerRateBps).toBe(600)
    expect(rateBpsFor(settings, plain)).toBe(800)
    expect(rateBpsFor(settings, partner)).toBe(600)
  })

  it('nadpisanie przy sprzedawcy bije wszystko', () => {
    expect(rateBpsFor(settings, { partner: false, overrideBps: 250 })).toBe(250)
    expect(rateBpsFor(settings, { partner: true, overrideBps: 250 })).toBe(250)
  })

  // Zero is a rate, not an absence of one, and treating it as falsy would
  // quietly charge 8% to the one seller who was promised nothing.
  it('nadpisanie na zero to prawdziwe zero', () => {
    expect(rateBpsFor(settings, { partner: false, overrideBps: 0 })).toBe(0)
  })
})

describe('oplata od pozycji', () => {
  it('procent zaokraglony w gore do pelnego centa', () => {
    // 12.34 EUR * 8% = 98.72 grosza
    expect(feeFor(1234, 800, 0)).toBe(99)
  })

  it('minimum wygrywa, kiedy procent jest od niego mniejszy', () => {
    // Minimalna cena 3 EUR: 8% to 24 grosze, wiec placi sie podloge.
    expect(feeFor(300, 800, 50)).toBe(50)
  })

  it('procent wygrywa, kiedy przerasta minimum', () => {
    expect(feeFor(10_000, 800, 50)).toBe(800)
  })

  it('brak gornego limitu', () => {
    expect(feeFor(1_000_000, 800, 50)).toBe(80_000)
  })

  it('darmowe nic nie kosztuje', () => {
    expect(feeFor(0, 800, 50)).toBe(0)
  })

  // A fee above the price would hand the seller a debt for making a sale.
  it('oplata nigdy nie przekracza ceny', () => {
    expect(feeFor(30, 800, 50)).toBe(30)
  })

  it('zawsze liczba calkowita i nieujemna', () => {
    for (let price = 0; price <= 5000; price += 7) {
      const fee = feeFor(price, 800, 50)
      expect(Number.isInteger(fee), `${price}`).toBe(true)
      expect(fee, `${price}`).toBeGreaterThanOrEqual(0)
      expect(fee, `${price}`).toBeLessThanOrEqual(price)
    }
  })
})

describe('koszyk kilku tworcow', () => {
  // The whole reason the fee is per item: charged on the sum, the cheap item
  // would ride on the expensive one and the floor would never apply.
  it('kazda pozycja placi za siebie', () => {
    const lines = chargeItems([
      { priceMinor: 3000, seller: plain },
      { priceMinor: 300, seller: plain },
    ], settings)

    expect(lines[0]!.feeMinor).toBe(240)
    expect(lines[1]!.feeMinor).toBe(50)
    expect(lines.reduce((sum, l) => sum + l.feeMinor, 0)).toBe(290)
  })

  it('nie liczy od sumy koszyka', () => {
    const together = feeFor(3300, 800, 50)
    const apart = chargeItems([
      { priceMinor: 3000, seller: plain },
      { priceMinor: 300, seller: plain },
    ], settings).reduce((sum, l) => sum + l.feeMinor, 0)

    expect(together).toBe(264)
    expect(apart).toBe(290)
    expect(apart).toBeGreaterThan(together)
  })

  it('stawka i minimum wracaja przy pozycji, zeby zamowienie je zapisalo', () => {
    const [line] = chargeItems([{ priceMinor: 1000, seller: partner }], settings)
    expect(line).toMatchObject({ rateBps: 600, minFeeMinor: 50, feeMinor: 60, netMinor: 940 })
  })

  it('netto zawsze domyka sie do ceny', () => {
    for (const price of [300, 499, 1000, 2599, 100_000]) {
      const [line] = chargeItems([{ priceMinor: price, seller: plain }], settings)
      expect(line!.netMinor + line!.feeMinor, `${price}`).toBe(price)
    }
  })
})

describe('konfiguracja z bazy', () => {
  it('pusta albo popsuta wraca do domyslnych', () => {
    expect(sanitizeSettings(undefined)).toEqual(COMMISSION_DEFAULTS)
    expect(sanitizeSettings({})).toEqual(COMMISSION_DEFAULTS)
    expect(sanitizeSettings({ rateBps: 'osiem' })).toEqual(COMMISSION_DEFAULTS)
    expect(sanitizeSettings({ rateBps: -5 })).toEqual(COMMISSION_DEFAULTS)
  })

  it('jedno zle pole nie kasuje reszty', () => {
    expect(sanitizeSettings({ rateBps: 1200, minFeeMinor: null }))
      .toEqual({ ...COMMISSION_DEFAULTS, rateBps: 1200 })
  })

  it('cena minimalna to 3 EUR', () => {
    expect(COMMISSION_DEFAULTS.minPriceMinor).toBe(300)
  })
})

describe('podzial calkowitych centow', () => {
  it('suma udzialow zawsze rowna kwocie wejsciowej', () => {
    for (const amount of [1, 2, 100, 999, 1234, 100_000]) {
      for (const shares of [[5000, 5000], [3333, 3333, 3334], [10_000], [7000, 2000, 1000]]) {
        const out = splitMinorUnits(amount, shares)
        expect(out.reduce((s, v) => s + v, 0), `${amount} / ${shares}`).toBe(amount)
        for (const value of out) expect(Number.isInteger(value)).toBe(true)
      }
    }
  })

  it('rowny podzial nierownej kwoty daje reszte pierwszemu rozniczonemu', () => {
    // 100 groszy na troje: 33.33 kazdemu, jeden grosz zostaje.
    expect(splitMinorUnits(100, [3333, 3333, 3334])).toEqual([33, 33, 34])
  })

  it('jeden udzialowiec bierze calosc', () => {
    expect(splitMinorUnits(777, [10_000])).toEqual([777])
  })

  // Largest remainder: the biggest share is served the first spare cent.
  it('kwota mniejsza niz liczba udzialowcow nie gubi centow', () => {
    expect(splitMinorUnits(2, [3333, 3333, 3334])).toEqual([1, 0, 1])
  })

  it('brak udzialow albo zerowa kwota to same zera', () => {
    expect(splitMinorUnits(0, [5000, 5000])).toEqual([0, 0])
    expect(splitMinorUnits(100, [])).toEqual([])
  })
})
