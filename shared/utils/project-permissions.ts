
// Rights on a single project, on top of whatever the organization grants. The
// same shape as the organization mask so both read the same way.
//
// To add a right: one entry here, one `catalog.projectPermissions.<key>` string
// per locale, and the check where it belongs.
export const PROJECT_PERMISSIONS = {
  upload_version: 1 << 0,
  delete_version: 1 << 1,
  edit_details: 1 << 2,
  edit_body: 1 << 3,
  manage_invites: 1 << 4,
  remove_member: 1 << 5,
  edit_member: 1 << 6,
  delete_project: 1 << 7,
  view_analytics: 1 << 8,
  view_payouts: 1 << 9,
} as const

export type ProjectPermission = keyof typeof PROJECT_PERMISSIONS

export const PROJECT_PERMISSION_KEYS = Object.keys(PROJECT_PERMISSIONS) as ProjectPermission[]

export const ALL_PROJECT_PERMISSIONS = PROJECT_PERMISSION_KEYS
  .reduce((mask, key) => mask | PROJECT_PERMISSIONS[key], 0)

// What somebody gets by being in the organization that owns the project,
// without anybody granting them anything on the project itself.
export const ORG_INHERITED_PROJECT_PERMISSIONS =
  PROJECT_PERMISSIONS.upload_version
  | PROJECT_PERMISSIONS.edit_details
  | PROJECT_PERMISSIONS.edit_body
  | PROJECT_PERMISSIONS.view_analytics

export function isProjectPermission(value: unknown): value is ProjectPermission {
  return PROJECT_PERMISSION_KEYS.includes(value as ProjectPermission)
}

export function hasProjectPermission(mask: number, permission: ProjectPermission): boolean {
  return (mask & PROJECT_PERMISSIONS[permission]) !== 0
}

export function projectMaskToList(mask: number): ProjectPermission[] {
  return PROJECT_PERMISSION_KEYS.filter(key => hasProjectPermission(mask, key))
}

export function projectListToMask(list: unknown): number {
  if (!Array.isArray(list)) return 0
  return list.reduce<number>(
    (mask, key) => (isProjectPermission(key) ? mask | PROJECT_PERMISSIONS[key] : mask),
    0,
  )
}

// The same rule as the organization: you cannot hand out what you do not hold.
export function canGrantProject(actorMask: number, wanted: number): boolean {
  return (wanted & ~actorMask) === 0
}
