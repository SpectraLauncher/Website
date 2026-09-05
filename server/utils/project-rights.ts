
import type { ProjectRow } from './catalog'
import { isAdmin } from './admin'
import { exec, one, q } from './db'
import { orgStanding } from './organization'
import {
  ALL_PROJECT_PERMISSIONS,
  ORG_INHERITED_PROJECT_PERMISSIONS,
  PROJECT_PERMISSIONS,
  type ProjectPermission,
  hasProjectPermission,
  projectMaskToList,
} from '../../shared/utils/project-permissions'
import { has } from '../../shared/utils/org-permissions'

export interface ProjectStanding {
  mask: number
  owner: boolean
  siteAdmin: boolean
}

// Rights come from three places, checked in the order that decides them:
// the account owns the project, the account was granted rights on this project
// directly, or the account is in the organization that owns it.
export async function projectStanding(
  project: ProjectRow,
  user: { id: string, role?: string | null } | null,
): Promise<ProjectStanding> {
  if (!user) return { mask: 0, owner: false, siteAdmin: false }

  if (isAdmin(user)) {
    return { mask: ALL_PROJECT_PERMISSIONS, owner: false, siteAdmin: true }
  }

  if (project.owner_id && project.owner_id === user.id) {
    return { mask: ALL_PROJECT_PERMISSIONS, owner: true, siteAdmin: false }
  }

  const granted = await one<{ permissions: string | number }>(
    'SELECT permissions FROM project_member WHERE project_id = $1 AND user_id = $2',
    [project.id, user.id],
  )

  let mask = granted ? Number(granted.permissions) & ALL_PROJECT_PERMISSIONS : 0

  if (project.org_id) {
    const standing = await orgStanding(project.org_id, user)
    if (standing) {
      // An organization owner holds everything on its projects; anyone else in
      // it gets the working set, and the rest has to be granted per project.
      mask |= standing.role === 'owner'
        ? ALL_PROJECT_PERMISSIONS
        : ORG_INHERITED_PROJECT_PERMISSIONS

      // Being allowed to remove projects from the organization implies being
      // allowed to delete one, so that right follows the organization
      // permission rather than being granted twice.
      if (has(standing.mask, 'remove_project')) {
        mask |= PROJECT_PERMISSIONS.delete_project
      }
    }
  }

  return { mask, owner: false, siteAdmin: false }
}

export async function mayProject(
  project: ProjectRow,
  user: { id: string, role?: string | null } | null,
  permission: ProjectPermission,
): Promise<boolean> {
  const standing = await projectStanding(project, user)
  return hasProjectPermission(standing.mask, permission)
}

export async function requireProjectPermission(
  project: ProjectRow,
  user: { id: string, role?: string | null } | null,
  permission: ProjectPermission,
): Promise<ProjectStanding> {
  const standing = await projectStanding(project, user)

  // Somebody with no rights at all is told the project does not exist; somebody
  // with some rights but not this one is told which right is missing, because
  // they already know the project is there.
  if (!standing.mask) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }
  if (!hasProjectPermission(standing.mask, permission)) {
    throw createError({ statusCode: 403, statusMessage: `you cannot ${permission} here` })
  }

  return standing
}

export interface ProjectMember {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  permissions: ProjectPermission[]
  added: number
}

export async function projectMembers(projectId: string): Promise<ProjectMember[]> {
  const rows = await q<{
    user_id: string
    permissions: string | number
    username: string | null
    name: string | null
    image: string | null
    created: string | number
  }>(
    `SELECT m.user_id, m.permissions, u.username, u.name, u.image, m.created
     FROM project_member m JOIN "user" u ON u.id = m.user_id
     WHERE m.project_id = $1 ORDER BY u.username`,
    [projectId],
  )

  return rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    name: row.name,
    image: row.image,
    permissions: projectMaskToList(Number(row.permissions)),
    added: Number(row.created),
  }))
}

export function setProjectMember(projectId: string, userId: string, mask: number) {
  return exec(
    `INSERT INTO project_member (project_id, user_id, permissions, created)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id, user_id) DO UPDATE SET permissions = EXCLUDED.permissions`,
    [projectId, userId, mask, Date.now()],
  )
}

export function removeProjectMember(projectId: string, userId: string) {
  return exec('DELETE FROM project_member WHERE project_id = $1 AND user_id = $2',
    [projectId, userId])
}
