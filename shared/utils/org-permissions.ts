
// Fine-grained rights inside an organization, on top of the coarse role
// better-auth stores. A bit each, so a member carries one number.
//
// To add a right: one entry here, one `org.permissions.<key>` string per locale,
// and the check itself where it belongs.
export const ORG_PERMISSIONS = {
  edit_details: 1 << 0,
  manage_invites: 1 << 1,
  remove_member: 1 << 2,
  edit_member: 1 << 3,
  add_project: 1 << 4,
  remove_project: 1 << 5,
  delete_organization: 1 << 6,
} as const

export type OrgPermission = keyof typeof ORG_PERMISSIONS

export const ORG_PERMISSION_KEYS = Object.keys(ORG_PERMISSIONS) as OrgPermission[]

export const ALL_ORG_PERMISSIONS = ORG_PERMISSION_KEYS
  .reduce((mask, key) => mask | ORG_PERMISSIONS[key], 0)

export const ORG_ROLES = ['member', 'admin', 'owner'] as const
export type OrgRole = typeof ORG_ROLES[number]

// Rank decides who may act on whom. Equal rank cannot touch equal rank, which is
// what stops two admins from removing each other in a loop.
export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
}

// What a role is worth before anyone edits the individual bits. Deleting the
// organization stays with the owner alone.
export const ROLE_DEFAULT_PERMISSIONS: Record<OrgRole, number> = {
  member: 0,
  admin: ALL_ORG_PERMISSIONS & ~ORG_PERMISSIONS.delete_organization,
  owner: ALL_ORG_PERMISSIONS,
}

export function isOrgRole(value: unknown): value is OrgRole {
  return ORG_ROLES.includes(value as OrgRole)
}

export function rankOf(role: string): number {
  return isOrgRole(role) ? ORG_ROLE_RANK[role] : -1
}

// An owner is not editable down to nothing: whatever the stored number says, the
// owner keeps every right, so an organization can never lock itself out.
export function permissionsOf(role: string, stored: number | null | undefined): number {
  if (role === 'owner') return ALL_ORG_PERMISSIONS
  if (stored === null || stored === undefined) {
    return isOrgRole(role) ? ROLE_DEFAULT_PERMISSIONS[role] : 0
  }
  return stored & ALL_ORG_PERMISSIONS
}

export function has(mask: number, permission: OrgPermission): boolean {
  return (mask & ORG_PERMISSIONS[permission]) !== 0
}

export function maskToList(mask: number): OrgPermission[] {
  return ORG_PERMISSION_KEYS.filter(key => has(mask, key))
}

export function listToMask(list: unknown): number {
  if (!Array.isArray(list)) return 0
  return list.reduce<number>(
    (mask, key) => (typeof key === 'string' && key in ORG_PERMISSIONS
      ? mask | ORG_PERMISSIONS[key as OrgPermission]
      : mask),
    0,
  )
}

// Modrinth's rule, and the reason the whole thing is a bitmask: you cannot hand
// out a right you do not hold yourself, so nobody escalates through someone
// they invited.
export function canGrant(actorMask: number, wanted: number): boolean {
  return (wanted & ~actorMask) === 0
}
