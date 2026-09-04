import { describe, expect, it } from 'vitest'

import {
  COMMISSION_REDUCED,
  COMMISSION_STANDARD,
  VERIFICATION_KINDS,
  commissionMinorUnits,
  commissionRate,
  isVerificationKind,
} from '../../server/utils/verification'

describe('prowizja', () => {
  it('zwykly sprzedawca placi stawke standardowa', () => {
    expect(commissionRate({ partner: false, verifiedOrg: false })).toBe(COMMISSION_STANDARD)
    expect(COMMISSION_STANDARD).toBe(0.01)
  })

  it('partner i zweryfikowana organizacja placa polowe', () => {
    expect(commissionRate({ partner: true, verifiedOrg: false })).toBe(COMMISSION_REDUCED)
    expect(commissionRate({ partner: false, verifiedOrg: true })).toBe(COMMISSION_REDUCED)
    expect(COMMISSION_REDUCED).toBe(COMMISSION_STANDARD / 2)
  })

  it('dwa tytuly do znizki nie kumuluja sie', () => {
    expect(commissionRate({ partner: true, verifiedOrg: true })).toBe(COMMISSION_REDUCED)
  })

  // Ceny sa w jednostkach minorowych, wiec prowizja tez musi byc calkowita —
  // ulamek centa nie istnieje po stronie procesora platnosci.
  it('kwota prowizji jest liczba calkowita', () => {
    for (const price of [1, 99, 100, 499, 1000, 1999, 250_00]) {
      for (const standing of [
        { partner: false, verifiedOrg: false },
        { partner: true, verifiedOrg: false },
      ]) {
        const fee = commissionMinorUnits(price, standing)
        expect(Number.isInteger(fee), `${price}`).toBe(true)
        expect(fee).toBeGreaterThanOrEqual(0)
        expect(fee).toBeLessThanOrEqual(price)
      }
    }
  })

  it('liczy znane kwoty', () => {
    // 10 EUR przy stawce standardowej to 10 centow.
    expect(commissionMinorUnits(1000, { partner: false, verifiedOrg: false })).toBe(10)
    // Ta sama kwota dla partnera to 5 centow.
    expect(commissionMinorUnits(1000, { partner: true, verifiedOrg: false })).toBe(5)
  })

  it('darmowy projekt nie generuje prowizji', () => {
    expect(commissionMinorUnits(0, { partner: false, verifiedOrg: false })).toBe(0)
  })
})

describe('rodzaje wnioskow', () => {
  it('sa dokladnie dwa i oba rozpoznawane', () => {
    expect(VERIFICATION_KINDS).toEqual(['partner', 'organization'])
    for (const kind of VERIFICATION_KINDS) expect(isVerificationKind(kind)).toBe(true)
  })

  it('nic innego nie przechodzi', () => {
    for (const value of ['admin', 'verified', '', null, 1, {}]) {
      expect(isVerificationKind(value), JSON.stringify(value)).toBe(false)
    }
  })
})
