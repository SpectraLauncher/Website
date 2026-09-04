
import { type ProjectRow, num } from './catalog'
import { projectPath } from './catalog-types'
import { one, q } from './db'

export interface OrgRow {
  id: string
  name: string
  slug: string
  logo: string | null
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
  const links: Record<string, string> = {}
  if (body.links && typeof body.links === 'object') {
    for (const [key, item] of Object.entries(body.links as Record<string, unknown>)) {
      if (typeof item === 'string' && item.trim()) links[key.slice(0, 40)] = item.trim().slice(0, 500)
    }
  }

  return {
    summary: typeof body.summary === 'string' ? body.summary.slice(0, 400) : '',
    description: typeof body.description === 'string' ? body.description.slice(0, 100_000) : '',
    links,
  }
}

export async function orgBySlug(slug: string): Promise<OrgRow | undefined> {
  return await one<OrgRow>(
    `SELECT id, name, slug, logo, metadata, "createdAt" FROM organization WHERE lower(slug) = $1`,
    [slug.toLowerCase()],
  )
}

export async function orgMembers(orgId: string): Promise<OrgMember[]> {
  const rows = await q<{
    userId: string
    role: string
    username: string | null
    name: string | null
    image: string | null
    createdAt: string | Date
  }>(
    `SELECT m."userId", m.role, u.username, u.name, u.image, m."createdAt"
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
  }))
}

export async function orgProjects(orgId: string, includeDrafts: boolean): Promise<ProjectRow[]> {
  const filter = includeDrafts ? '' : `AND status = 'published'`

  // sql-safe: `filter` is one of two constant fragments chosen above, never request text
  return await q<ProjectRow>(
    `SELECT id::text, slug, type, owner_id, org_id, title, summary, description, status,
            license, license_url, icon, categories, game_versions, loaders, links, meta,
            downloads, follows, created, updated, published
     FROM project WHERE org_id = $1 ${filter}
     ORDER BY downloads DESC, updated DESC`,
    [orgId],
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
