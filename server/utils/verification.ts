
import { exec, one, q } from './db'
import { newId } from './ids'

export const VERIFICATION_KINDS = ['partner', 'organization'] as const
export type VerificationKind = typeof VERIFICATION_KINDS[number]

export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
export type VerificationStatus = typeof VERIFICATION_STATUSES[number]

export interface VerificationRow {
  id: string
  kind: VerificationKind
  user_id: string | null
  org_id: string | null
  status: VerificationStatus
  body: string
  links: Record<string, string>
  reviewed_by: string | null
  reviewed_at: string | number | null
  review_note: string
  created: string | number
}

export const COMMISSION_STANDARD = 0.01
export const COMMISSION_REDUCED = 0.005

export interface SellerStanding {
  partner: boolean
  verifiedOrg: boolean
}

// The rate a sale is charged at. Partner accounts and verified organizations pay
// half, and both of those are moderator decisions rather than self-service.
export function commissionRate(standing: SellerStanding): number {
  return standing.partner || standing.verifiedOrg ? COMMISSION_REDUCED : COMMISSION_STANDARD
}

export function commissionMinorUnits(price: number, standing: SellerStanding): number {
  return Math.round(price * commissionRate(standing))
}

export function isVerificationKind(value: unknown): value is VerificationKind {
  return VERIFICATION_KINDS.includes(value as VerificationKind)
}

const COLUMNS = `id, kind, user_id, org_id, status, body, links,
  reviewed_by, reviewed_at, review_note, created`

export async function openRequestFor(
  userId: string | null,
  orgId: string | null,
): Promise<VerificationRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<VerificationRow>(
    `SELECT ${COLUMNS} FROM verification_request
     WHERE status = 'pending' AND ($1::text IS NULL OR user_id = $1)
       AND ($2::text IS NULL OR org_id = $2)`,
    [userId, orgId],
  )
}

export async function requestsForUser(userId: string): Promise<VerificationRow[]> {
  // sql-safe: COLUMNS is a constant column list
  return await q<VerificationRow>(
    `SELECT ${COLUMNS} FROM verification_request
     WHERE user_id = $1 OR org_id IN (SELECT "organizationId" FROM member WHERE "userId" = $1)
     ORDER BY created DESC`,
    [userId],
  )
}

export async function pendingQueue(): Promise<VerificationRow[]> {
  // sql-safe: COLUMNS is a constant column list
  return await q<VerificationRow>(
    `SELECT ${COLUMNS} FROM verification_request WHERE status = 'pending' ORDER BY created`,
  )
}

export async function requestById(id: string): Promise<VerificationRow | undefined> {
  // sql-safe: COLUMNS is a constant column list
  return await one<VerificationRow>(`SELECT ${COLUMNS} FROM verification_request WHERE id = $1`, [id])
}

export async function submitRequest(input: {
  kind: VerificationKind
  userId: string | null
  orgId: string | null
  body: string
  links: Record<string, string>
}): Promise<VerificationRow> {
  // sql-safe: COLUMNS is a constant column list
  const row = await one<VerificationRow>(
    `INSERT INTO verification_request (id, kind, user_id, org_id, body, links, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [newId(), input.kind, input.userId, input.orgId, input.body,
      JSON.stringify(input.links), Date.now()],
  )
  return row!
}

export async function withdrawRequest(id: string) {
  await exec(
    `UPDATE verification_request SET status = 'withdrawn' WHERE id = $1 AND status = 'pending'`,
    [id],
  )
}

// Approving is what actually sets the flag. Nothing else writes it, so the flag
// and the decision that produced it cannot drift apart.
export async function decideRequest(
  row: VerificationRow,
  approve: boolean,
  moderatorId: string,
  note: string,
) {
  await exec(
    `UPDATE verification_request
     SET status = $2, reviewed_by = $3, reviewed_at = $4, review_note = $5
     WHERE id = $1`,
    [row.id, approve ? 'approved' : 'rejected', moderatorId, Date.now(), note],
  )

  if (!approve) return

  if (row.kind === 'partner' && row.user_id) {
    await exec('UPDATE "user" SET partner = TRUE WHERE id = $1', [row.user_id])
  }
  if (row.kind === 'organization' && row.org_id) {
    await exec('UPDATE organization SET verified = TRUE WHERE id = $1', [row.org_id])
  }
}

export async function revokeStanding(kind: VerificationKind, subjectId: string) {
  if (kind === 'partner') {
    await exec('UPDATE "user" SET partner = FALSE WHERE id = $1', [subjectId])
    return
  }
  await exec('UPDATE organization SET verified = FALSE WHERE id = $1', [subjectId])
}

export function publicRequest(row: VerificationRow) {
  return {
    id: row.id,
    kind: row.kind,
    userId: row.user_id,
    orgId: row.org_id,
    status: row.status,
    body: row.body,
    links: row.links,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : null,
    created: Number(row.created),
  }
}

export interface DescribedRequest extends ReturnType<typeof publicRequest> {
  subject: { kind: VerificationKind, slug: string | null, name: string | null, image: string | null }
}

// The queue shows who is asking, not an opaque id.
export async function describeRequest(row: VerificationRow): Promise<DescribedRequest> {
  if (row.org_id) {
    const org = await one<{ slug: string, name: string, logo: string | null }>(
      'SELECT slug, name, logo FROM organization WHERE id = $1', [row.org_id])
    return {
      ...publicRequest(row),
      subject: {
        kind: 'organization',
        slug: org?.slug ?? null,
        name: org?.name ?? null,
        image: org?.logo ?? null,
      },
    }
  }

  const user = await one<{ username: string | null, name: string | null, image: string | null }>(
    'SELECT username, name, image FROM "user" WHERE id = $1', [row.user_id])

  return {
    ...publicRequest(row),
    subject: {
      kind: 'partner',
      slug: user?.username ?? null,
      name: user?.name ?? user?.username ?? null,
      image: user?.image ?? null,
    },
  }
}
