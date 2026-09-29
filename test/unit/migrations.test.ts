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

describe('003 usuwa platnosci', () => {
  const tables = [
    'payout_request', 'webhook_event', 'entitlement', 'ledger_entry', 'sale_item', 'sale',
    'org_split', 'connected_account',
  ]
  const third = MIGRATIONS.find(m => m.id === '003-drop-payments')!

  it('zrzuca kazda tabele platnosci i odtwarza ja w down', () => {
    for (const table of tables) {
      expect(third.up, table).toMatch(new RegExp(`\\b${table}\\b`))
      expect(third.down, table).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`)
    }
  })

  it('zdejmuje cene z projektu i oddaje ja w down', () => {
    expect(third.up).toContain('DROP COLUMN IF EXISTS price')
    expect(third.up).toContain('DROP COLUMN IF EXISTS currency')
    expect(third.down).toContain('ADD COLUMN IF NOT EXISTS price')
    expect(third.down).toContain('ADD COLUMN IF NOT EXISTS currency')
  })

  it('baseline nie tworzy juz tabel ani kolumn platnosci', async () => {
    const { readFileSync } = await import('node:fs')
    const baseline = readFileSync('server/utils/schema-catalog.ts', 'utf8')

    for (const table of tables) {
      expect(baseline, table).not.toContain(`CREATE TABLE IF NOT EXISTS ${table} (`)
    }
    expect(baseline).not.toMatch(/ADD COLUMN IF NOT EXISTS (price|currency)/)
  })
})
