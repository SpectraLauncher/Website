// Reverses one applied migration. A `down` that cannot be run is not a `down`,
// so this exists to make the reversal a command rather than a plan:
//
//   pnpm db:rollback 001-drop-express-payment-tables
//
// It builds its own pool instead of importing server/utils/db.ts, because that
// file calls Nitro's auto-imported createError, which does not exist outside a
// running server.
import fs from 'node:fs'
import path from 'node:path'

import pg from 'pg'

const id = process.argv[2]
if (!id) {
  console.error('usage: pnpm db:rollback <migration-id>')
  process.exit(1)
}

let url = process.env.DATABASE_URL
if (!url && fs.existsSync('.env')) {
  const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .find(l => l.startsWith('DATABASE_URL='))
  url = line?.slice('DATABASE_URL='.length)
}

if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const { MIGRATIONS, rollbackMigration } = await import(
  path.resolve('server/utils/migrations.ts').replace(/\\/g, '/'))

const migration = MIGRATIONS.find(m => m.id === id)
if (!migration) {
  console.error(`no migration called ${id}. Known: ${MIGRATIONS.map(m => m.id).join(', ')}`)
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url })

const applied = await pool.query('SELECT id FROM schema_migration WHERE id = $1', [id])
if (!applied.rowCount) {
  console.error(`${id} is not applied to this database`)
  await pool.end()
  process.exit(1)
}

console.info(`rolling back ${id}`)
await rollbackMigration(pool, id)
console.info('done')

await pool.end()
