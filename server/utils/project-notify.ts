
import type { H3Event } from 'h3'
import type { ProjectRow } from './catalog'
import { isListed } from '../../shared/utils/catalog-types'
import { isAdmin } from '../../shared/utils/staff-roles'
import { q } from './db'
import { isOrgMember, orgMembers } from './organization'
import { commentById } from './project-thread'
import { rateLimit } from './rateLimit'
import { notify, notifyOthers } from './social'

// The moderation thread is between the people who can fix the project and the
// people who decide about it — nobody else, whatever the project's status.
export async function canSeeThread(
  project: ProjectRow,
  viewer: { id: string, role?: string | null },
): Promise<boolean> {
  if (isAdmin(viewer)) return true
  if (project.owner_id && project.owner_id === viewer.id) return true
  if (project.org_id) return Boolean(await isOrgMember(project.org_id, viewer.id))
  return false
}

export async function ownerIdsOf(project: ProjectRow): Promise<string[]> {
  if (project.owner_id) return [project.owner_id]
  if (!project.org_id) return []

  const members = await orgMembers(project.org_id)
  return members.filter(m => m.role === 'owner' || m.role === 'admin').map(m => m.userId)
}

export async function notifyOwners(project: ProjectRow, n: {
  kind: Parameters<typeof notify>[0]['kind']
  actorId: string
  projectId: string
  data?: unknown
}) {
  return await notifyOthers(await ownerIdsOf(project), n)
}

export async function notifyStaff(n: {
  kind: Parameters<typeof notify>[0]['kind']
  actorId: string
  projectId: string
  data?: unknown
}) {
  const admins = await q<{ id: string }>(`SELECT id FROM "user" WHERE role = 'admin'`)
  return await notifyOthers(admins.map(row => row.id), n)
}

export async function notifyComment(input: {
  project: ProjectRow
  actorId: string
  parentId: string | null
}) {
  if (input.parentId) {
    const parent = await commentById(input.parentId)
    if (parent) {
      await notifyOthers([parent.author_id], {
        kind: 'comment_reply',
        actorId: input.actorId,
        projectId: input.project.id,
      })
    }
  }

  await notifyOwners(input.project, {
    kind: 'project_comment',
    actorId: input.actorId,
    projectId: input.project.id,
  })
}

// Keyed by account rather than address: comments cost nothing to write and a
// shared address should not stop a second person commenting.
export function commentRateLimit(event: H3Event, userId: string) {
  return rateLimit(event, { key: `comment:${userId}`, limit: 10, windowMs: 60_000 })
}

/**
 * Tell everyone following a project that it has a new version.
 *
 * Only for a project the public can actually see: a version added to a draft or
 * to something under moderation is not news, and announcing it would leak that
 * the project exists. The author gets nothing — notifyOthers drops the actor.
 */
export async function notifyFollowers(project: ProjectRow, input: {
  actorId: string
  version: string
}) {
  if (!isListed(project.status)) return []

  const followers = await q<{ user_id: string }>(
    'SELECT user_id FROM project_follow WHERE project_id = $1',
    [project.id],
  )

  return await notifyOthers(followers.map(row => row.user_id), {
    kind: 'project_updated',
    actorId: input.actorId,
    projectId: project.id,
    data: { version: input.version },
  })
}
