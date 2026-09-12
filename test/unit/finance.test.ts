import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { payoutsCsv } = await import('../../server/utils/finance')

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  userId: 'u1',
  username: 'makotopd',
  email: 'a@b.pl',
  amountMinor: 241860,
  status: 'requested',
  note: '',
  requested: 1757600000000,
  settled: null,
  ...over,
} as never)

describe('eksport wyplat', () => {
  it('naglowek i kwota w jednostkach glownych', () => {
    const csv = payoutsCsv([row()])
    const [head, line] = csv.split('\n')

    expect(head).toBe('id,user,email,amount,status,requested,settled')
    expect(line).toContain('2418.60')
    expect(line).toContain('makotopd')
  })

  // A cell a spreadsheet would run instead of showing. The classic way a CSV
  // export turns into someone else's shell.
  it('formula nie zostaje formula', () => {
    for (const nasty of ['=1+1', '+SUM(A1)', '-2', '@foo', '=HYPERLINK("http://x")']) {
      const line = payoutsCsv([row({ username: nasty })]).split('\n')[1]!

      // no cell may begin with a character a spreadsheet reads as a formula
      expect(line, nasty).not.toMatch(/(?:^|,)"?[=+\-@]/)
      expect(line, nasty).toContain(`'${nasty[0]}`)
    }
  })

  it('przecinek i cudzyslow nie rozjezdzaja kolumn', () => {
    const csv = payoutsCsv([row({ username: 'a,b', email: 'say "hi"' })])
    const line = csv.split('\n')[1]!

    expect(line).toContain('"a,b"')
    expect(line).toContain('"say ""hi"""')
    // still seven columns
    expect(line.match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g)).toHaveLength(7)
  })

  it('brak daty rozliczenia to pusta komorka, nie 1970', () => {
    expect(payoutsCsv([row({ settled: null })]).split('\n')[1]!.endsWith(',')).toBe(true)
  })
})

describe('trasy finansow', () => {
  it('obie sa za brama admina', () => {
    expect(readFileSync('server/api/admin/finance.get.ts', 'utf8')).toMatch(/requireAdmin\(event\)/)

    const csv = readFileSync('server/api/admin/finance/payouts.csv.get.ts', 'utf8')
    expect(csv).toMatch(/requireAdmin\(event\)/)
    // an export of everyone's earnings is worth a line in the log
    expect(csv).toMatch(/recordStaffAction/)
  })
})
