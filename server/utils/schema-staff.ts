import { usePool } from './db'

/**
 * Invitations to the team.
 *
 * A role is offered and accepted rather than assigned, so nobody wakes up as a
 * moderator because a select was one row off. The row is the offer; the role
 * itself still lives in "user".role and is written only when the invitation is
 * accepted.
 */
export async function ensureStaffSchema() {
  const pool = usePool()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_invite (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role       TEXT NOT NULL,
      -- Kept as a name as well as an id: the invitation has to read sensibly
      -- after the account that sent it is gone.
      invited_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      inviter    TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'pending',
      created    BIGINT NOT NULL,
      expires    BIGINT NOT NULL,
      answered   BIGINT
    );

    -- One open offer per person: a second invitation while the first is still
    -- unanswered is the same question asked twice.
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_invite_pending
      ON staff_invite (user_id) WHERE status = 'pending';

    CREATE INDEX IF NOT EXISTS idx_staff_invite_status
      ON staff_invite (status, created DESC);
  `)
}
