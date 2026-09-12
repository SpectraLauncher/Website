import { usePool } from './db'

/**
 * Every staff action, written once and never edited.
 *
 * The point of the table is to answer "who did this to my project" months after
 * the fact, so it records the actor, the subject and a rendered summary rather
 * than a foreign key that will be null once the subject is deleted — a removed
 * project is exactly the case the log exists for.
 *
 * Same additive pattern as the other schema modules: CREATE TABLE IF NOT EXISTS
 * first, every later column as its own ALTER ... ADD COLUMN IF NOT EXISTS.
 */
export async function ensureAuditSchema() {
  const pool = usePool()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_action (
      id          TEXT PRIMARY KEY,
      -- The account is allowed to disappear; the record of what it did is not,
      -- so the name is copied in rather than joined at read time.
      actor_id    TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      actor_name  TEXT NOT NULL DEFAULT '',
      action      TEXT NOT NULL,
      subject_kind TEXT NOT NULL DEFAULT '',
      subject_id  TEXT NOT NULL DEFAULT '',
      -- What the row says in a list, written at the time. Rendering it later
      -- from ids would show the subject's current name, not the one it had.
      summary     TEXT NOT NULL DEFAULT '',
      meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- Where the action came from: the panel, the Discord bot, a script.
      source      TEXT NOT NULL DEFAULT 'panel',
      created     BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_staff_action_created ON staff_action (created DESC);
    CREATE INDEX IF NOT EXISTS idx_staff_action_actor ON staff_action (actor_id, created DESC);
    CREATE INDEX IF NOT EXISTS idx_staff_action_subject ON staff_action (subject_kind, subject_id, created DESC);
  `)
}
