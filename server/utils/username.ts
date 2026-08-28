
import { exec, one, q } from './db'
import { usernameBase, withSuffix } from './username-slug'

export async function uniqueUsername(preferred: string): Promise<string> {
  const base = usernameBase(preferred)

  const candidates = [base, ...Array.from({ length: 20 }, (_, i) => withSuffix(base, String(i + 2)))]
  const taken = new Set(
    (await q<{ username: string }>('SELECT username FROM "user" WHERE username = ANY($1)', [candidates]))
      .map(r => r.username),
  )
  const free = candidates.find(c => !taken.has(c))
  if (free) return free

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = withSuffix(base, Math.random().toString(36).slice(2, 8))
    if (!await one('SELECT 1 FROM "user" WHERE username = $1', [candidate])) return candidate
  }
  throw new Error(`could not find a free username for "${base}"`)
}

export async function backfillUsernames(): Promise<number> {
  const rows = await q<{ id: string, name: string | null, email: string }>(
    'SELECT id, name, email FROM "user" WHERE username IS NULL',
  )

  for (const row of rows) {
    const username = await uniqueUsername(row.name || row.email.split('@')[0] || 'player')
    await exec(
      'UPDATE "user" SET username = $1, "displayUsername" = COALESCE("displayUsername", $1) WHERE id = $2',
      [username, row.id],
    )
  }
  return rows.length
}
