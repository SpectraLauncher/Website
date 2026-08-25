// Every table this app owns, created on boot next to better-auth's own
// migration.
//
// Timestamps stay epoch-milliseconds `bigint` instead of `timestamptz`: they
// cross the wire to a Rust launcher and a browser, both of which speak epoch
// ms, and converting in three places invites the bug where one of them is off
// by a timezone.

import { usePool } from './db'

export async function ensureSchema() {
  const pool = usePool()
  await pool.query(`
    -- Share codes. The pack itself lives in R2; only its key is here.
    CREATE TABLE IF NOT EXISTS shares (
      code        TEXT PRIMARY KEY,
      created     BIGINT NOT NULL,
      expires     BIGINT NOT NULL,
      name        TEXT,
      mc_version  TEXT,
      loader      TEXT,
      mods        INTEGER NOT NULL DEFAULT 0,
      size        BIGINT NOT NULL DEFAULT 0,
      downloads   INTEGER NOT NULL DEFAULT 0,
      owner_id    TEXT,
      instance_id TEXT,
      revision    INTEGER NOT NULL DEFAULT 1,
      object_key  TEXT,
      uploaded    BOOLEAN NOT NULL DEFAULT TRUE,
      pending_key TEXT,
      pending_at  BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires);
    CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id, instance_id);

    -- One row per pair, not per direction: requester_id remembers who asked.
    CREATE TABLE IF NOT EXISTS friendship (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      requester_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      addressee_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      created      BIGINT NOT NULL,
      UNIQUE (requester_id, addressee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friendship_addressee ON friendship(addressee_id, status);
    CREATE INDEX IF NOT EXISTS idx_friendship_requester ON friendship(requester_id, status);

    CREATE TABLE IF NOT EXISTS notification (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      actor_id   TEXT REFERENCES "user"(id) ON DELETE CASCADE,
      share_code TEXT,
      data       JSONB,
      read       BOOLEAN NOT NULL DEFAULT FALSE,
      created    BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(user_id, id);

    -- Who a code was sent to, and which revision they installed.
    CREATE TABLE IF NOT EXISTS share_recipient (
      code              TEXT NOT NULL,
      user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      sent              BIGINT NOT NULL,
      imported_revision INTEGER,
      PRIMARY KEY (code, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_share_recipient_user ON share_recipient(user_id);

    -- Anonymous telemetry. No PII: a random per-install id and coarse counts.
    CREATE TABLE IF NOT EXISTS events (
      id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ts         BIGINT NOT NULL,
      day        TEXT   NOT NULL,
      install_id TEXT   NOT NULL,
      event      TEXT   NOT NULL,
      version    TEXT,
      os         TEXT,
      arch       TEXT,
      locale     TEXT,
      props      JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_events_day     ON events(day);
    CREATE INDEX IF NOT EXISTS idx_events_event   ON events(event);
    CREATE INDEX IF NOT EXISTS idx_events_install ON events(install_id);

    -- Discord. Written by the admin panel, read by the bot process in the
    -- dc-bot repo — the two never call each other, this database is the whole
    -- interface between them. Created here rather than there because this app
    -- is the one with a schema step, and the panel writes the config before the
    -- bot has any reason to read it.
    --
    -- Prefixed, because guild_config and tickets are far too generic to sit
    -- unqualified next to shares and events.
    CREATE TABLE IF NOT EXISTS discord_config (
      guild_id                TEXT PRIMARY KEY,
      log_channel             TEXT,
      ticket_category         TEXT,
      ticket_archive_category TEXT,
      ticket_panel_channel    TEXT,
      ticket_prefix           TEXT NOT NULL DEFAULT 'ticket-',
      ticket_open_embed       JSONB NOT NULL DEFAULT '{}',
      ticket_panel_embed      JSONB NOT NULL DEFAULT '{}'
    );

    -- Temporary voice channels, added after discord_config already existed.
    --
    -- These cannot go in the CREATE TABLE above. On a database that already has
    -- the table, IF NOT EXISTS skips the whole statement — so the columns would
    -- appear on a fresh install and nowhere else, which is exactly what
    -- happened: column "voice_hub" does not exist, in production only.
    --
    -- Any future column on a table that already exists needs its own ALTER for
    -- the same reason. ADD COLUMN IF NOT EXISTS is idempotent, so this is safe
    -- to run on every boot and safe on a fresh database too.
    ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS voice_hub      TEXT;
    ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS voice_category TEXT;
    ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS release_channel TEXT;
    ALTER TABLE discord_config ADD COLUMN IF NOT EXISTS release_role    TEXT;

    -- One row per launcher release already announced. GitHub retries a webhook
    -- it thinks failed and lets you redeliver by hand, and neither should ping
    -- the server twice — the release id is the thing that must be unique.
    CREATE TABLE IF NOT EXISTS discord_releases (
      release_id TEXT PRIMARY KEY,
      tag        TEXT NOT NULL,
      posted     BIGINT NOT NULL
    );

    -- The channels that hub created. They are deleted the moment the last
    -- person leaves, so this table is a list of what is currently alive — and
    -- the only way to tell an auto-created channel from a permanent one.
    CREATE TABLE IF NOT EXISTS discord_temp_channels (
      channel_id TEXT PRIMARY KEY,
      guild_id   TEXT NOT NULL,
      owner_id   TEXT NOT NULL,
      created    BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_discord_temp_guild ON discord_temp_channels(guild_id);

    -- Roles that can see every ticket. Pinged when one opens.
    CREATE TABLE IF NOT EXISTS discord_ticket_roles (
      guild_id TEXT NOT NULL,
      role_id  TEXT NOT NULL,
      PRIMARY KEY (guild_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS discord_tickets (
      id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      guild_id        TEXT NOT NULL,
      channel_id      TEXT NOT NULL UNIQUE,
      user_id         TEXT NOT NULL,
      topic           TEXT,
      status          TEXT NOT NULL DEFAULT 'open',
      -- The channel is renamed and archived on close, so the transcript is the
      -- only durable record of what was actually said.
      transcript_html TEXT,
      created         BIGINT NOT NULL,
      closed          BIGINT,
      closed_by       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_discord_tickets_open ON discord_tickets(guild_id, status);
    CREATE INDEX IF NOT EXISTS idx_discord_tickets_user ON discord_tickets(guild_id, user_id);

    CREATE TABLE IF NOT EXISTS discord_warnings (
      id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      guild_id     TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason       TEXT,
      created      BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_discord_warnings_user ON discord_warnings(guild_id, user_id);

    -- One row per guild per direction. embed_json is a Discord embed as the
    -- panel's editor produced it; the bot substitutes {username} and friends at
    -- send time rather than storing anything resolved.
    CREATE TABLE IF NOT EXISTS discord_welcome (
      guild_id     TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      enabled      BOOLEAN NOT NULL DEFAULT FALSE,
      channel_id   TEXT,
      message_type TEXT NOT NULL DEFAULT 'text',
      content      TEXT NOT NULL DEFAULT '',
      embed_json   JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (guild_id, event_type)
    );
  `)

  // better-auth maps a `number` field to `integer`, and epoch milliseconds do
  // not fit in four bytes — the heartbeat failed with "out of range". Widened
  // here, and only when it has not been widened already, so boot does not
  // rewrite the table every time.
  const narrow = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user' AND column_name = 'lastSeen' AND data_type = 'integer'
  `)
  if (narrow.rowCount) {
    await pool.query('ALTER TABLE "user" ALTER COLUMN "lastSeen" TYPE BIGINT')
  }

  // One Minecraft profile belongs to one account. better-auth creates the
  // columns (see `additionalFields`); the uniqueness is ours to enforce, and it
  // is what stops two people claiming the same name.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_mc_uuid ON "user"("mcUuid")
    WHERE "mcUuid" IS NOT NULL
  `)

  // Two notifications for the same person, of the same kind, in the same
  // millisecond are the same notification — a double-fired insert, not two
  // events. The index is what makes that unrepresentable.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_moment
      ON notification(user_id, kind, created)
  `)
}

/**
 * better-auth 1.7 stopped identifying an external account by `providerId` alone
 * and started using the pair (`issuer`, `accountId`). Its own migration cannot
 * add the column: `issuer` is NOT NULL with no default, and a populated
 * `account` table has nothing to backfill it with — so it refuses and boot fails
 * with "Cannot add required column issuer to populated table account".
 *
 * We add and backfill it ourselves, before `runMigrations()` runs, so by the
 * time better-auth inspects the table the column is already there and correct.
 *
 * The values are not ours to invent — they have to match exactly what 1.7
 * computes at sign-in, or the row will not be found and the user gets a second
 * account. Taken from the provider definitions in @better-auth/core:
 *
 *   credential            local:credential          (createLocalAccountIssuer)
 *   google                https://accounts.google.com
 *   microsoft             the `iss` claim of the account's own id_token
 *   any other OAuth       local:oauth:<providerId>  (createOAuthAccountIssuer)
 *
 * Microsoft also changed which claim identifies the account: 1.6 stored the
 * pairwise, app-specific `sub`, 1.7 stores the stable directory `oid`. Both
 * claims sit in the id_token we already have on the row, so the rewrite is
 * exact and nobody has to sign in again.
 */
export async function ensureAccountIssuer() {
  const pool = usePool()

  // A fresh database has no `account` table yet: better-auth is about to create
  // it, with `issuer` already part of the definition. Nothing to migrate, and
  // an ALTER here would throw before `runMigrations()` ever got to run.
  const table = await pool.query(`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'account'
  `)
  if (!table.rowCount) return

  const column = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account' AND column_name = 'issuer'
  `)
  if (column.rowCount) return

  // Nullable first — the whole point is that NOT NULL cannot be added to rows
  // that have no value yet.
  await pool.query('ALTER TABLE account ADD COLUMN issuer TEXT')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`UPDATE account SET issuer = 'local:credential' WHERE "providerId" = 'credential'`)
    await client.query(`UPDATE account SET issuer = 'https://accounts.google.com' WHERE "providerId" = 'google'`)
    await client.query(`
      UPDATE account SET issuer = 'local:oauth:' || "providerId"
      WHERE "providerId" NOT IN ('credential', 'google', 'microsoft')
    `)

    // Microsoft: issuer and accountId both come out of the stored id_token.
    const ms = await client.query<{ id: string, idToken: string | null }>(
      `SELECT id, "idToken" FROM account WHERE "providerId" = 'microsoft'`
    )
    for (const row of ms.rows) {
      const claims = decodeJwtClaims(row.idToken)
      const iss = typeof claims?.iss === 'string' ? claims.iss : null
      const oid = typeof claims?.oid === 'string' ? claims.oid : null
      if (!iss || !oid) {
        // No id_token to read, so there is no honest value to write. Leaving it
        // NULL trips the NOT NULL below on purpose: a wrong issuer is worse
        // than a failed boot, because it silently splits one person into two
        // accounts on their next sign-in.
        console.error(`[db] account ${row.id}: microsoft row has no usable id_token — cannot derive issuer/oid`)
        continue
      }
      await client.query('UPDATE account SET issuer = $1, "accountId" = $2 WHERE id = $3', [iss, oid, row.id])
    }

    const blank = await client.query('SELECT count(*)::int AS n FROM account WHERE issuer IS NULL')
    if (blank.rows[0]!.n > 0) {
      throw new Error(`${blank.rows[0]!.n} account row(s) have no issuer — refusing to finish the migration`)
    }

    // Collisions would make the unique index fail with a message that says
    // nothing about which rows are at fault. Say it here instead.
    const dupes = await client.query<{ issuer: string, accountId: string, n: number }>(`
      SELECT issuer, "accountId", count(*)::int AS n FROM account
      GROUP BY issuer, "accountId" HAVING count(*) > 1
    `)
    if (dupes.rowCount) {
      const list = dupes.rows.map(d => `${d.issuer} / ${d.accountId} (${d.n}x)`).join(', ')
      throw new Error(`identity collisions after backfill: ${list}`)
    }

    await client.query('ALTER TABLE account ALTER COLUMN issuer SET NOT NULL')
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_accountId_uidx" ON account (issuer, "accountId")')

    await client.query('COMMIT')
    console.info(`[db] backfilled account.issuer for better-auth 1.7 (${ms.rowCount} microsoft row(s) re-keyed to oid)`)
  } catch (e) {
    await client.query('ROLLBACK')
    // The ADD COLUMN above is outside the transaction, so a half-migrated table
    // would look "already done" on the next boot and skip the backfill. Undo it.
    await pool.query('ALTER TABLE account DROP COLUMN IF EXISTS issuer')
    throw e
  } finally {
    client.release()
  }
}

/** Payload of a JWT, without verifying it — these are our own stored tokens. */
function decodeJwtClaims(token: string | null): Record<string, unknown> | null {
  const part = token?.split('.')[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}
