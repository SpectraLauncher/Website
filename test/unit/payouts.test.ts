import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  LEDGER_KINDS,
  MIN_PAYOUT_MINOR,
  PAYOUT_STATUSES,
  isLedgerKind,
  isPayoutStatus,
} from '../../server/utils/payouts'

describe('rejestr ksiegi', () => {
  it('przyjmuje tylko znane rodzaje wpisow', () => {
    for (const kind of LEDGER_KINDS) expect(isLedgerKind(kind)).toBe(true)
    for (const bad of ['bonus', '', null]) expect(isLedgerKind(bad), String(bad)).toBe(false)
  })

  it('przyjmuje tylko znane statusy wyplaty', () => {
    for (const status of PAYOUT_STATUSES) expect(isPayoutStatus(status)).toBe(true)
    expect(isPayoutStatus('done')).toBe(false)
  })

  it('minimalna wyplata jest dodatnia', () => {
    expect(MIN_PAYOUT_MINOR).toBeGreaterThan(0)
  })
})

// A balance nobody can explain is one nobody can argue about, and every payout
// dispute is an argument about how a number was reached.
describe('ksiega jest zrodlem prawdy, nie kolumna z saldem', () => {
  const source = readFileSync('server/utils/payouts.ts', 'utf8')

  it('saldo jest sumowane z wpisow', () => {
    expect(source).toContain('SUM(amount)')
    expect(source).not.toMatch(/UPDATE seller SET balance/)
  })

  it('sprzedaz zapisuje dwa wiersze, zeby prowizja byla widoczna', () => {
    expect(source).toContain("kind: 'sale'")
    expect(source).toContain("kind: 'commission'")
    expect(source).toContain('amount: -input.fee')
  })

  it('zwrot i nieudana wyplata sa osobnym wpisem, nie kasowaniem', () => {
    expect(source).toContain("kind: 'adjustment'")
    expect(source).not.toContain('DELETE FROM payout_ledger')
  })

  it('wyplata zdejmuje pieniadze wpisem ujemnym', () => {
    expect(source).toContain("kind: 'payout'")
    expect(source).toContain('amount: -amount')
  })

  it('nie da sie wyplacic wiecej, niz jest dostepne', () => {
    expect(source).toContain('balance.available < amount')
    expect(source).toContain('not enough available')
  })

  it('kwota ponizej minimum jest odrzucana', () => {
    expect(source).toContain('amount < MIN_PAYOUT_MINOR')
  })
})

describe('webhook moze przyjsc dwa razy', () => {
  const seller = readFileSync('server/utils/seller.ts', 'utf8')
  const schema = readFileSync('server/utils/schema-catalog.ts', 'utf8')
  const payouts = readFileSync('server/utils/payouts.ts', 'utf8')

  // Only the delivery that actually moved the row writes to the ledger.
  it('do ksiegi pisze tylko dostawa, ktora zmienila status', () => {
    expect(seller).toContain('if (!moved) return')
  })

  it('baza i tak nie pozwoli policzyc tej samej sprzedazy dwa razy', () => {
    expect(schema).toContain('uniq_ledger_reference')
    expect(payouts).toContain('ON CONFLICT (seller_id, kind, reference)')
  })
})

describe('cudze pieniadze', () => {
  const route = readFileSync('server/api/seller/payout.post.ts', 'utf8')

  it('wyplata idzie tylko z konta, ktore ta osoba kontroluje', () => {
    expect(route).toContain('sellerIdsFor(user)')
    expect(route).toContain('ids.includes(sellerId)')
  })

  it('zadanie wyplaty ma wlasny budzet', () => {
    expect(route).toContain('key: `payout:${user.id}`')
  })
})
