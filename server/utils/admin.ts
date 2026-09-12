
import type { H3Event } from 'h3'

const FALLBACK = ['patrydab4@gmail.com']

// Only used to promote the first admin on an empty database — see
// `ensureAdminRole()` in schema.ts. Never consulted when checking a request:
// an address is only as trustworthy as the weakest provider willing to assert
// it, and e-mail verification switches itself off when no mail key is set.
export function parseAdminEmails(raw: string): string[] {
  const configured = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return configured.length ? configured : FALLBACK
}

export function isAdminEmail(email: string | null | undefined, list: string[]): boolean {
  const value = email?.trim().toLowerCase()
  return Boolean(value && list.includes(value))
}

export function bootstrapAdminEmails(): string[] {
  return parseAdminEmails(String(useRuntimeConfig().adminEmails || process.env.ADMIN_EMAILS || ''))
}

// The gate itself: a row in the database, nothing else. isAdmin, canModerate and
// isOwner live in shared/utils/staff-roles, because the panel's navigation asks
// the same questions in the browser.

// 404 rather than 403 everywhere: 403 confirms the thing exists.
const missing = () => createError({ statusCode: 404, statusMessage: 'not found' })

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!isAdmin(user)) throw missing()
  return user
}

/** Anyone on the team. Opens the panel; says nothing about what is inside it. */
export async function requireStaff(event: H3Event) {
  const user = await requireUser(event)
  if (!isStaff(user)) throw missing()
  return user
}

/** The queue, reports, verification and scans — a moderator's whole job. */
export async function requireModeration(event: H3Event) {
  const user = await requireUser(event)
  if (!canModerate(user)) throw missing()
  return user
}

/** Handing out roles, and nothing else so far. */
export async function requireOwner(event: H3Event) {
  const user = await requireUser(event)
  if (!isOwner(user)) throw missing()
  return user
}
