/**
 * Who works here, and how much of the panel they get.
 *
 * One ladder rather than a set of permissions per person: every question the
 * panel asks is "is this account at least X", and a rank answers that with a
 * comparison instead of a table nobody keeps in step. A finer model can replace
 * this the day a role needs a permission another role above it lacks — nothing
 * here assumes that never happens, but nothing invents it before it does.
 *
 * To add a role: one entry in STAFF_ROLES and one rank. Everything that gates on
 * it goes through atLeast().
 */
export const STAFF_ROLES = ['moderator', 'admin', 'owner'] as const
export type StaffRole = typeof STAFF_ROLES[number]

const RANK: Record<string, number> = {
  moderator: 1,
  admin: 2,
  owner: 3,
}

export interface WithRole {
  role?: string | null
}

export function isStaffRole(value: unknown): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole)
}

export function staffRank(user: WithRole | null | undefined): number {
  return RANK[String(user?.role ?? '')] ?? 0
}

export function atLeast(user: WithRole | null | undefined, role: StaffRole): boolean {
  return staffRank(user) >= RANK[role]!
}

/** Anyone on the team. What opens the panel at all. */
export function isStaff(user: WithRole | null | undefined): boolean {
  return staffRank(user) > 0
}

/**
 * The catalog queue, reports, verification and scans.
 *
 * Deliberately not the same question as isAdmin: a moderator decides what gets
 * published and what gets taken down, and touches nothing else.
 */
export function canModerate(user: WithRole | null | undefined): boolean {
  return atLeast(user, 'moderator')
}

/** Accounts, badges, Discord, articles, the newsletter, platform figures. */
export function isAdmin(user: WithRole | null | undefined): boolean {
  return atLeast(user, 'admin')
}

/**
 * Who may hand out roles.
 *
 * Kept to one person on purpose: an admin who can promote can promote
 * themselves, and then the ladder has no top.
 */
export function isOwner(user: WithRole | null | undefined): boolean {
  return atLeast(user, 'owner')
}
