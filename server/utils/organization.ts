
import { type ProjectRow, num } from './catalog'
import { LISTED_STATUSES, projectPath } from '../../shared/utils/catalog-types'
import type { H3Event } from 'h3'
import { isAdmin } from './admin'
import { exec, one, q } from './db'

export interface OrgRow {
  id: string
  name: string
  slug: string
  logo: string | null
  verified: boolean
  metadata: unknown
  createdAt: string | Date
}

export interface OrgMember {
  userId: string
  role: string
  username: string | null
  name: string | null
  image: string | null
  joined: number
  permissions: OrgPermission[]
}

export interface OrgMeta {
  summary: string
  description: string
  links: Record<string, string>
}

// better-auth owns the organization table, so metadata is the sanctioned place
// to hang anything of ours on it. Depending on the adapter it comes back as an
// object or as the JSON string it was stored as.
export function orgMeta(raw: unknown): OrgMeta {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      value = {}
    }
  }

  const body = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>

  return {
    summary: typeof body.summary === 'string' ? body.summary.slice(0, 400) : '',
    description: typeof body.description === 'string' ? body.description.slice(0, 100_000) : '',
    links: cleanLinks(body.links),
  }
}

export async function orgBySlug(slug: string): Promise<OrgRow | undefined> {
  return await one<OrgRow>(
    `SELECT id, name, slug, logo, COALESCE(verified, FALSE) AS verified, metadata, "createdAt"
     FROM organization WHERE lower(slug) = $1`,
    [slug.toLowerCase()],
  )
}

export async function orgMembers(orgId: string): Promise<OrgMember[]> {
  const rows = await q<{
    userId: string
    role: string
    permissions: string | number | null
    username: string | null
    name: string | null
    image: string | null
    createdAt: string | Date
  }>(
    `SELECT m."userId", m.role, m.permissions, u.username, u.name, u.image, m."createdAt"
     FROM member m JOIN "user" u ON u.id = m."userId"
     WHERE m."organizationId" = $1
     ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.username`,
    [orgId],
  )

  return rows.map(row => ({
    userId: row.userId,
    role: row.role,
    username: row.username,
    name: row.name,
    image: row.image,
    joined: new Date(row.createdAt).getTime() || 0,
    permissions: maskToList(permissionsOf(row.role, row.permissions === null ? null : Number(row.permissions))),
  }))
}

export async function orgProjects(orgId: string, includeDrafts: boolean): Promise<ProjectRow[]> {
  const filter = includeDrafts ? '' : 'AND status = ANY($2)'

  // sql-safe: `filter` is one of two constant fragments chosen above, never request text
  return await q<ProjectRow>(
    `SELECT id, slug, type, owner_id, org_id, title, summary, description, status,
            license, license_url, icon, categories, game_versions, loaders, links, meta,
            downloads, follows, created, updated, published
     FROM project WHERE org_id = $1 ${filter}
     ORDER BY downloads DESC, updated DESC`,
    includeDrafts ? [orgId] : [orgId, LISTED_STATUSES],
  )
}

export async function isOrgMember(orgId: string, userId: string): Promise<string | null> {
  const row = await one<{ role: string }>(
    `SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2`, [orgId, userId])
  return row?.role ?? null
}

// The panel invites by username because that is what people know each other by,
// but better-auth invites by e-mail. The address is looked up here and never
// travels back to the caller — otherwise the invite form would be an e-mail
// oracle for every username on the site.
export async function emailForUsername(username: string): Promise<string | null> {
  const row = await one<{ email: string }>(
    `SELECT email FROM "user" WHERE lower(username) = $1`, [username.trim().toLowerCase()])
  return row?.email ?? null
}

export function publicOrg(org: OrgRow, meta: OrgMeta) {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    logo: org.logo,
    verified: org.verified,
    summary: meta.summary,
    description: meta.description,
    links: meta.links,
    created: new Date(org.createdAt).getTime() || 0,
  }
}

export function orgProjectCard(project: ProjectRow) {
  return {
    id: project.id,
    slug: project.slug,
    type: project.type,
    path: projectPath(project.type, project.slug),
    title: project.title,
    summary: project.summary,
    icon: project.icon,
    status: project.status,
    downloads: num(project.downloads),
    updated: num(project.updated),
  }
}

export interface OrgSummary {
  id: string
  slug: string
  name: string
  logo: string | null
  role: string
}

export async function organizationsOf(userId: string): Promise<OrgSummary[]> {
  return await q<OrgSummary>(
    `SELECT o.id, o.slug, o.name, o.logo, m.role
     FROM member m JOIN organization o ON o.id = m."organizationId"
     WHERE m."userId" = $1
     ORDER BY o.name`,
    [userId],
  )
}

export interface ProjectOwner {
  kind: 'user' | 'organization'
  slug: string | null
  name: string | null
  image: string | null
}

// Who a project page credits. An organization-owned project credits the
// organization, not whichever member happened to upload it.
export async function projectOwner(
  ownerId: string | null,
  orgId: string | null,
): Promise<ProjectOwner | null> {
  if (orgId) {
    const org = await one<{ slug: string, name: string, logo: string | null }>(
      'SELECT slug, name, logo FROM organization WHERE id = $1', [orgId])
    return org
      ? { kind: 'organization', slug: org.slug, name: org.name, image: org.logo }
      : null
  }

  if (!ownerId) return null

  const user = await one<{ username: string | null, name: string | null, image: string | null }>(
    'SELECT username, name, image FROM "user" WHERE id = $1', [ownerId])
  return user
    ? { kind: 'user', slug: user.username, name: user.name ?? user.username, image: user.image }
    : null
}

export interface Standing {
  role: string
  mask: number
  rank: number
  siteAdmin: boolean
}

export async function orgStanding(
  orgId: string,
  user: { id: string, role?: string | null },
): Promise<Standing | null> {
  const row = await one<{ role: string, permissions: string | number | null }>(
    'SELECT role, permissions FROM member WHERE "organizationId" = $1 AND "userId" = $2',
    [orgId, user.id],
  )

  // A site administrator acts with an owner's hand without being a member, so
  // an abandoned organization is still reachable.
  if (!row) {
    return isAdmin(user)
      ? { role: 'owner', mask: ALL_ORG_PERMISSIONS, rank: ORG_ROLE_RANK.owner, siteAdmin: true }
      : null
  }

  const stored = row.permissions === null ? null : Number(row.permissions)
  return {
    role: row.role,
    mask: isAdmin(user) ? ALL_ORG_PERMISSIONS : permissionsOf(row.role, stored),
    rank: isAdmin(user) ? ORG_ROLE_RANK.owner : rankOf(row.role),
    siteAdmin: isAdmin(user),
  }
}

export async function ownerCount(orgId: string): Promise<number> {
  const row = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1 AND role = 'owner'`,
    [orgId],
  )
  return row?.n ?? 0
}

export function setMemberRole(orgId: string, userId: string, role: string) {
  return exec('UPDATE member SET role = $3 WHERE "organizationId" = $1 AND "userId" = $2',
    [orgId, userId, role])
}

export function setMemberPermissions(orgId: string, userId: string, mask: number | null) {
  return exec('UPDATE member SET permissions = $3 WHERE "organizationId" = $1 AND "userId" = $2',
    [orgId, userId, mask])
}

export function removeMember(orgId: string, userId: string) {
  return exec('DELETE FROM member WHERE "organizationId" = $1 AND "userId" = $2', [orgId, userId])
}

export async function memberCount(orgId: string): Promise<number> {
  const row = await one<{ n: string }>(
    'SELECT count(*)::text AS n FROM member WHERE "organizationId" = $1', [orgId])
  return Number(row?.n ?? 0)
}

// project.org_id cascades, so the projects go with it. That is the point: an
// organization with nobody in it owns projects nobody can administer, publish a
// fix for, or take down.
export function deleteOrganization(orgId: string) {
  return exec('DELETE FROM organization WHERE id = $1', [orgId])
}

export interface MemberContext {
  org: OrgRow
  actor: Standing
  target: OrgMember
}

// Every member route needs the same four answers, and getting any of them wrong
// is a privilege bug rather than a 500.
export async function memberContext(event: H3Event): Promise<MemberContext> {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const actor = await orgStanding(org.id, user)
  if (!actor) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const userId = String(getRouterParam(event, 'userId') ?? '')
  const target = (await orgMembers(org.id)).find(member => member.userId === userId)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'no such member' })

  if (target.userId === user.id) {
    throw createError({ statusCode: 409, statusMessage: 'use the leave endpoint for yourself' })
  }

  return { org, actor, target }
}
