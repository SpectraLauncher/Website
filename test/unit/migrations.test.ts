import { describe, expect, it } from 'vitest'

import { MIGRATIONS } from '../../server/utils/migrations'

// The registry is the whole safety mechanism: an id that repeats, or one that
// changes after it has been applied somewhere, makes the schema_migration table
// lie about what a database actually has. None of that needs Postgres to catch.
describe('rejestr migracji', () => {
  it('kazde id jest unikalne', () => {
    const ids = MIGRATIONS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('id sa numerowane i ustawione rosnaco', () => {
    const ids = MIGRATIONS.map(m => m.id)
    for (const id of ids) expect(id, id).toMatch(/^\d{3}-[a-z0-9-]+$/)
    expect(ids).toEqual([...ids].sort())
  })

  it('kazda migracja ma obie strony', () => {
    for (const migration of MIGRATIONS) {
      expect(migration.up.trim(), migration.id).not.toBe('')
      expect(migration.down.trim(), migration.id).not.toBe('')
    }
  })

  // A down that does not name what its up touched is a down nobody wrote.
  it('001 odtwarza wszystkie cztery tabele, ktore zrzuca', () => {
    const first = MIGRATIONS.find(m => m.id === '001-drop-express-payment-tables')!

    for (const table of ['seller', 'purchase', 'payout_ledger', 'payout']) {
      expect(first.up, table).toContain(`DROP TABLE IF EXISTS ${table}`)
      expect(first.down, table).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`)
    }
  })

  it('baseline nie tworzy juz tego, co migracja zrzuca', async () => {
    const { readFileSync } = await import('node:fs')
    const baseline = readFileSync('server/utils/schema-catalog.ts', 'utf8')

    for (const table of ['seller', 'purchase', 'payout_ledger', 'payout']) {
      expect(baseline, table).not.toContain(`CREATE TABLE IF NOT EXISTS ${table} (`)
    }
  })
})
