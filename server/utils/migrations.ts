
import type pg from 'pg'

// ensureSchema() and ensureCatalogSchema() build the schema additively: every
// statement is CREATE TABLE IF NOT EXISTS or ALTER TABLE ADD COLUMN IF NOT
// EXISTS, so running them twice changes nothing. That works right up to the
// first destructive change, which cannot be expressed that way — a DROP has no
// idempotent form that is also safe, and there is nothing to tell a database
// that never had the column from one where it was deliberately removed.
//
// So: the ensure* pair stays the baseline, and everything destructive lives
// here as a numbered step applied once and recorded. Migrations run after the
// baseline, because a step that alters a table needs the table to exist.
//
// The registry is TypeScript rather than .sql files on disk on purpose. Nitro
// bundles the server, and files read at runtime are not part of that bundle
// unless they are declared as assets — a migration that works in dev and is
// missing in production is exactly the failure this is supposed to prevent.
//
// To add a migration: append an entry. Never edit or renumber an applied one —
// it has already run somewhere, and the recorded id is all that says so.
//
//   {
//     id: '002-short-name',
//     up: `ALTER TABLE ...`,
//     down: `ALTER TABLE ...`,
//   },
//
// `down` has to actually reverse `up`. Where that is impossible without losing
// data, say so in the SQL as a comment and reverse the structure at least.

export interface Migration {
  id: string
  up: string
  down: string
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: '001-drop-express-payment-tables',
    // Built for Express accounts and destination charges, replaced wholesale.
    // They only ever held two test seller rows, both already deleted.
    up: `
      DROP TABLE IF EXISTS payout_ledger;
      DROP TABLE IF EXISTS payout;
      DROP TABLE IF EXISTS purchase;
      DROP TABLE IF EXISTS seller;
    `,
    down: `
      CREATE TABLE IF NOT EXISTS seller (
        id                TEXT PRIMARY KEY,
        user_id           TEXT REFERENCES "user"(id) ON DELETE CASCADE,
        org_id            TEXT,
        stripe_account    TEXT NOT NULL,
        charges_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
        payouts_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
        details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
        country           TEXT,
        created           BIGINT NOT NULL,
        updated           BIGINT NOT NULL,
        CONSTRAINT seller_one_subject CHECK (num_nonnulls(user_id, org_id) = 1)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_seller_user ON seller (user_id) WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_seller_org ON seller (org_id) WHERE org_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_seller_account ON seller (stripe_account);

      CREATE TABLE IF NOT EXISTS purchase (
        id         TEXT PRIMARY KEY,
        buyer_id   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        seller_id  TEXT REFERENCES seller(id) ON DELETE SET NULL,
        amount     INTEGER NOT NULL,
        currency   TEXT NOT NULL,
        fee        INTEGER NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending',
        session_id TEXT,
        intent_id  TEXT,
        created    BIGINT NOT NULL,
        completed  BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_purchase_buyer ON purchase (buyer_id, project_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_session ON purchase (session_id)
        WHERE session_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase (status, created);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_owned
        ON purchase (buyer_id, project_id) WHERE status = 'paid';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_open
        ON purchase (buyer_id, project_id) WHERE status = 'pending';

      CREATE TABLE IF NOT EXISTS payout_ledger (
        id        TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES seller(id) ON DELETE CASCADE,
        kind      TEXT NOT NULL,
        amount    BIGINT NOT NULL,
        currency  TEXT NOT NULL,
        reference TEXT,
        note      TEXT NOT NULL DEFAULT '',
        created   BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_seller ON payout_ledger (seller_id, created DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_reference
        ON payout_ledger (seller_id, kind, reference) WHERE reference IS NOT NULL;

      CREATE TABLE IF NOT EXISTS payout (
        id        TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES seller(id) ON DELETE CASCADE,
        amount    BIGINT NOT NULL,
        currency  TEXT NOT NULL,
        status    TEXT NOT NULL DEFAULT 'requested',
        note      TEXT NOT NULL DEFAULT '',
        requested BIGINT NOT NULL,
        settled   BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_payout_seller ON payout (seller_id, requested DESC);
    `,
  },
  {
    id: '002-one-featured-image-per-project',
    // The project page uses the featured image as its backdrop, so two of them
    // means the backdrop depends on which row comes back first. Nothing stopped
    // that until now, hence the cleanup before the index.
    up: `
      UPDATE project_gallery g SET featured = FALSE
      WHERE g.featured AND g.id <> (
        SELECT id FROM project_gallery
        WHERE project_id = g.project_id AND featured
        ORDER BY ordering, id
        LIMIT 1
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_gallery_featured
        ON project_gallery (project_id) WHERE featured;
    `,
    // Structure only. Which images were featured before the cleanup is not
    // recorded anywhere, so dropping the index cannot bring them back.
    down: `
      DROP INDEX IF EXISTS uniq_gallery_featured;
    `,
  },
  {
    id: '003-drop-payments',
    up: `
      DROP TABLE IF EXISTS payout_request, webhook_event, entitlement, ledger_entry, sale_item, sale,
        org_split, connected_account;
      ALTER TABLE project DROP COLUMN IF EXISTS price, DROP COLUMN IF EXISTS currency;
    `,
    down: `
      ALTER TABLE project ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE project ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

      CREATE TABLE IF NOT EXISTS connected_account (
        id                TEXT PRIMARY KEY,
        user_id           TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        stripe_account    TEXT NOT NULL UNIQUE,
        country           TEXT,
        transfers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        payouts_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
        details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
        requirements      JSONB   NOT NULL DEFAULT '{}',
        commission_override_bps INTEGER,
        created           BIGINT NOT NULL,
        updated           BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS org_split (
        org_id    TEXT NOT NULL,
        user_id   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        share_bps INTEGER NOT NULL CHECK (share_bps >= 0 AND share_bps <= 10000),
        updated   BIGINT NOT NULL,
        PRIMARY KEY (org_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_org_split_user ON org_split (user_id);

      CREATE TABLE IF NOT EXISTS sale (
        id            TEXT PRIMARY KEY,
        buyer_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        status        TEXT NOT NULL DEFAULT 'pending',
        currency      TEXT NOT NULL DEFAULT 'eur',
        total_minor   INTEGER NOT NULL,
        fee_minor     INTEGER NOT NULL,
        intent_id     TEXT,
        charge_id     TEXT,
        consent_at    BIGINT NOT NULL,
        consent_terms TEXT NOT NULL,
        created       BIGINT NOT NULL,
        paid          BIGINT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_sale_intent ON sale (intent_id)
        WHERE intent_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_sale_buyer ON sale (buyer_id, status);
      CREATE INDEX IF NOT EXISTS idx_sale_status ON sale (status, created);
      ALTER TABLE sale ALTER COLUMN buyer_id DROP NOT NULL;
      ALTER TABLE sale ADD COLUMN IF NOT EXISTS buyer_email TEXT;
      ALTER TABLE sale ADD COLUMN IF NOT EXISTS access_token TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_sale_token ON sale (access_token)
        WHERE access_token IS NOT NULL;

      CREATE TABLE IF NOT EXISTS sale_item (
        id             TEXT PRIMARY KEY,
        sale_id        TEXT NOT NULL REFERENCES sale(id) ON DELETE CASCADE,
        project_id     TEXT REFERENCES project(id) ON DELETE SET NULL,
        title          TEXT NOT NULL,
        seller_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        seller_org_id  TEXT,
        price_minor    INTEGER NOT NULL,
        fee_minor      INTEGER NOT NULL,
        rate_bps       INTEGER NOT NULL,
        min_fee_minor  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sale_item_sale ON sale_item (sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_item_project ON sale_item (project_id);

      CREATE TABLE IF NOT EXISTS ledger_entry (
        id           TEXT PRIMARY KEY,
        user_id      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        sale_item_id TEXT REFERENCES sale_item(id) ON DELETE SET NULL,
        kind         TEXT NOT NULL,
        state        TEXT NOT NULL DEFAULT 'pending',
        share_bps    INTEGER,
        amount_minor BIGINT NOT NULL,
        transfer_id  TEXT,
        reference    TEXT,
        note         TEXT NOT NULL DEFAULT '',
        created      BIGINT NOT NULL,
        settled      BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entry (user_id, state);
      CREATE INDEX IF NOT EXISTS idx_ledger_item ON ledger_entry (sale_item_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_due ON ledger_entry (state, created)
        WHERE state = 'pending';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_sale
        ON ledger_entry (sale_item_id, user_id, kind) WHERE sale_item_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS entitlement (
        user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        project_id   TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        sale_item_id TEXT REFERENCES sale_item(id) ON DELETE SET NULL,
        granted      BIGINT NOT NULL,
        revoked      BIGINT,
        PRIMARY KEY (user_id, project_id)
      );
      CREATE INDEX IF NOT EXISTS idx_entitlement_project ON entitlement (project_id);

      CREATE TABLE IF NOT EXISTS webhook_event (
        id        TEXT PRIMARY KEY,
        type      TEXT NOT NULL,
        payload   JSONB NOT NULL,
        received  BIGINT NOT NULL,
        processed BIGINT,
        attempts  INTEGER NOT NULL DEFAULT 0,
        error     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed ON webhook_event (received)
        WHERE processed IS NULL;

      CREATE TABLE IF NOT EXISTS payout_request (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        payout_id    TEXT,
        amount_minor BIGINT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'requested',
        note         TEXT NOT NULL DEFAULT '',
        requested    BIGINT NOT NULL,
        settled      BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_payout_user ON payout_request (user_id, requested DESC);
    `,
  },
  {
    id: '004-remember-approval',
    up: `
      UPDATE project SET approved = COALESCE(published, updated)
      WHERE approved IS NULL AND status IN ('published', 'unlisted', 'archived');
    `,
    down: `
      UPDATE project SET approved = NULL;
    `,
  },
  {
    id: '005-addons-have-no-minecraft-fields',
    up: `
      UPDATE version SET loaders = '{}', game_versions = '{}'
      WHERE project_id IN (SELECT id FROM project WHERE type = 'addon');
      UPDATE project SET loaders = '{}', game_versions = '{}', environment = '{}'
      WHERE type = 'addon';
    `,
    down: `
      UPDATE version SET loaders = '{spectra}'
      WHERE project_id IN (SELECT id FROM project WHERE type = 'addon');
      UPDATE project SET loaders = '{spectra}', environment = '{client}'
      WHERE type = 'addon';
    `,
  },
]

// Chosen once and never changed: two instances booting together must queue on
// the same number or they both run the same migration.
const LOCK_KEY = 8_147_205_311

async function ensureTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      id      TEXT PRIMARY KEY,
      applied BIGINT NOT NULL
    )
  `)
}

export async function appliedMigrations(pool: pg.Pool): Promise<string[]> {
  await ensureTable(pool)
  const res = await pool.query<{ id: string }>('SELECT id FROM schema_migration ORDER BY id')
  return res.rows.map(row => row.id)
}

// Postgres runs DDL inside transactions, so a migration that throws halfway
// leaves nothing behind — the schema and the record of it move together or not
// at all.
export async function runSchemaMigrations(pool: pg.Pool): Promise<string[]> {
  await ensureTable(pool)

  const client = await pool.connect()
  const ran: string[] = []

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])

    const done = new Set(
      (await client.query<{ id: string }>('SELECT id FROM schema_migration')).rows.map(r => r.id),
    )

    for (const migration of MIGRATIONS) {
      if (done.has(migration.id)) continue

      await client.query('BEGIN')
      try {
        await client.query(migration.up)
        await client.query(
          'INSERT INTO schema_migration (id, applied) VALUES ($1, $2)',
          [migration.id, Date.now()],
        )
        await client.query('COMMIT')
      }
      catch (e) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${migration.id} failed: ${(e as Error).message}`, { cause: e })
      }

      ran.push(migration.id)
    }
  }
  finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    client.release()
  }

  return ran
}

export async function rollbackMigration(pool: pg.Pool, id: string): Promise<void> {
  const migration = MIGRATIONS.find(m => m.id === id)
  if (!migration) throw new Error(`no migration called ${id}`)

  await ensureTable(pool)

  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
    await client.query('BEGIN')
    try {
      await client.query(migration.down)
      await client.query('DELETE FROM schema_migration WHERE id = $1', [id])
      await client.query('COMMIT')
    }
    catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  }
  finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    client.release()
  }
}
