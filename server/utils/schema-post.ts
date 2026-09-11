import { usePool } from './db'

/**
 * Articles and newsletter issues, in one table.
 *
 * Same reasoning as the catalog's single project table: an article and an issue
 * are both a titled document with a body, a state and an author, and the parts
 * that differ — a slug and a cover for one, a send record for the other — are
 * columns that stay null on the kind that has no use for them. Two tables would
 * mean two editors, two image paths and two places to fix a bug.
 *
 * Same pattern as ensureSchema(): CREATE TABLE IF NOT EXISTS to begin with, and
 * every later column in its own ALTER ... ADD COLUMN IF NOT EXISTS, because on a
 * database that already has the table, IF NOT EXISTS skips the whole statement.
 */
export async function ensurePostSchema() {
  const pool = usePool()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post (
      id         TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      -- Articles only. Unique where present, so two drafts can both be untitled
      -- but two published articles cannot share an address.
      slug       TEXT,
      title      TEXT NOT NULL DEFAULT '',
      summary    TEXT NOT NULL DEFAULT '',
      -- The editor's own JSON. HTML is rendered from it on the way out, never
      -- stored, so a change to the renderer reaches everything ever written.
      body       JSONB NOT NULL DEFAULT '{}'::jsonb,
      cover      TEXT,
      status     TEXT NOT NULL DEFAULT 'draft',
      author_id  TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created    BIGINT NOT NULL,
      updated    BIGINT NOT NULL,
      published  BIGINT,
      -- Newsletters only: when it went out and to how many. Set once; a second
      -- send is refused rather than counted twice.
      sent       BIGINT,
      recipients INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_post_slug ON post (slug) WHERE slug IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_post_kind ON post (kind, status, published DESC);
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscriber (
      id        TEXT PRIMARY KEY,
      email     TEXT NOT NULL,
      user_id   TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      -- One click out, no sign-in. The token is the whole authorisation, so it
      -- is random and never derived from the address.
      token     TEXT NOT NULL,
      confirmed BIGINT,
      created   BIGINT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_email
      ON newsletter_subscriber (lower(email));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_token
      ON newsletter_subscriber (token);
  `)
}
