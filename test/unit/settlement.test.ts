import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { settleable } from '../../server/utils/ledger'

const rows = (...amounts: number[]) =>
  amounts.map((amount, i) => ({ id: `e${i}`, amount_minor: amount }))

describe('co jeden transfer moze rozliczyc', () => {
  it('bierze wszystko, kiedy miesci sie w limicie', () => {
    expect(settleable(rows(500, 300), 1000))
      .toEqual({ amountMinor: 800, entryIds: ['e0', 'e1'] })
  })

  // A transfer is tied to the charge that funded it, and Stripe will not let
  // transfers against one charge add up to more than it.
  it('nie przekracza limitu ladunku', () => {
    const out = settleable(rows(600, 600), 1000)
    expect(out.amountMinor).toBe(600)
    expect(out.entryIds).toEqual(['e0'])
  })

  it('to, co sie nie zmiescilo, zostaje na pozniej', () => {
    const out = settleable(rows(400, 400, 400), 900)
    expect(out.amountMinor).toBe(800)
    expect(out.entryIds).toHaveLength(2)
  })

  // Debts only ever reduce the total, and skipping one would mean paying out
  // money the seller still owes.
  it('dlugi bierze zawsze, niezaleznie od limitu', () => {
    const out = settleable(rows(-1000, 200), 100)
    expect(out.entryIds).toContain('e0')
    expect(out.amountMinor).toBe(-800)
  })

  it('dlug wiekszy niz zarobek daje kwote ujemna, czyli nic do wyplaty', () => {
    expect(settleable(rows(300, -500), 10_000).amountMinor).toBe(-200)
  })

  it('sam dlug to tez nic do wyplaty', () => {
    expect(settleable(rows(-250), 10_000).amountMinor).toBe(-250)
  })

  it('pusta ksiega nic nie rozlicza', () => {
    expect(settleable([], 1000)).toEqual({ amountMinor: 0, entryIds: [] })
  })

  it('kwoty z bazy przychodza jako stringi i nadal sie licza', () => {
    const out = settleable([
      { id: 'a', amount_minor: '500' },
      { id: 'b', amount_minor: '-200' },
    ], 1000)

    expect(out.amountMinor).toBe(300)
  })
})

// The recovery mechanism is that a chargeback is a pending negative row: what we
// owe somebody is the sum of their pending rows, so a debt sits there reducing
// it until later sales cover it.
describe('odzyskiwanie dlugu po obciazeniu zwrotnym', () => {
  const ledger = readFileSync('server/utils/ledger.ts', 'utf8')
  const transfers = readFileSync('server/utils/transfers.ts', 'utf8')

  it('obciazenie zwrotne jest wpisem oczekujacym, nie przelanym', () => {
    expect(ledger).toContain(`'chargeback', 'pending'`)
  })

  it('nic nie wychodzi, dopoki suma nie jest dodatnia', () => {
    expect(transfers).toContain('amountMinor <= 0')
  })

  it('brak konta wstrzymuje przelew, nie kasuje naleznosci', () => {
    expect(transfers).toContain('if (!canReceive(account)) return')
    expect(transfers).not.toMatch(/DELETE FROM ledger_entry/)
  })
})
