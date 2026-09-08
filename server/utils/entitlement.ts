
import { exec, one } from './db'

// The right to download a paid project. Its own table rather than a walk back
// through sale_item because it is read on every download of every paid file, and
// because "one paid copy per person per project" has nowhere else to live - the
// buyer is on the sale and the project is on the item, and no index spans two
// tables.
export async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  const row = await one<{ user_id: string }>(
    `SELECT user_id FROM entitlement
     WHERE user_id = $1 AND project_id = $2 AND revoked IS NULL`,
    [userId, projectId],
  )

  return Boolean(row)
}

// Written when a payment succeeds, from a webhook that may arrive twice. The
// conflict clause is what makes the second delivery a no-op rather than an
// error that leaves the rest of the batch unprocessed.
export async function grantEntitlement(input: {
  userId: string
  projectId: string
  saleItemId: string
}): Promise<void> {
  await exec(
    `INSERT INTO entitlement (user_id, project_id, sale_item_id, granted)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, project_id) DO UPDATE
       SET revoked = NULL, sale_item_id = EXCLUDED.sale_item_id`,
    [input.userId, input.projectId, input.saleItemId, Date.now()],
  )
}

// A chargeback or a refund takes the download away, but the row stays: it is
// still the record that this person once bought this, and the books need it.
export async function revokeEntitlement(userId: string, projectId: string): Promise<void> {
  await exec(
    `UPDATE entitlement SET revoked = $3
     WHERE user_id = $1 AND project_id = $2 AND revoked IS NULL`,
    [userId, projectId, Date.now()],
  )
}

export async function libraryOf(userId: string) {
  return await q<{
    project_id: string
    granted: string
    price_minor: number
    title: string
    slug: string | null
    type: string | null
    icon: string | null
  }>(
    `SELECT e.project_id, e.granted, i.price_minor, i.title,
            p.slug, p.type, p.icon
     FROM entitlement e
     LEFT JOIN sale_item i ON i.id = e.sale_item_id
     LEFT JOIN project p ON p.id = e.project_id
     WHERE e.user_id = $1 AND e.revoked IS NULL
     ORDER BY e.granted DESC`,
    [userId],
  )
}

// The newest primary file per project, which is what a download link points at.
// DISTINCT ON is the cheap way to say "one row per project, newest first"
// without a window function or a second query per project.
export async function primaryFilesFor(projectIds: string[]) {
  if (!projectIds.length) return new Map<string, { id: string, filename: string, size: number }>()

  const rows = await q<{
    project_id: string
    id: string
    filename: string
    size: string
  }>(
    `SELECT DISTINCT ON (v.project_id)
            v.project_id, f.id, f.filename, f.size
     FROM version v
     JOIN version_file f ON f.version_id = v.id
     WHERE v.project_id = ANY($1)
     ORDER BY v.project_id, v.created DESC, f.is_primary DESC, f.filename`,
    [projectIds],
  )

  return new Map(rows.map(row => [row.project_id, {
    id: row.id,
    filename: row.filename,
    size: Number(row.size),
  }]))
}

// Whether a token opens this particular project. The token is a guest's whole
// credential, so it is only ever accepted against a paid sale that actually
// contained the thing being asked for.
export async function tokenOpensProject(token: string, projectId: string): Promise<boolean> {
  if (token.length < 16) return false

  const row = await one<{ id: string }>(
    `SELECT i.id FROM sale s
     JOIN sale_item i ON i.sale_id = s.id
     WHERE s.access_token = $1 AND s.status = 'paid' AND i.project_id = $2`,
    [token, projectId],
  )

  return Boolean(row)
}
