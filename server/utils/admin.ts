
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

// The gate itself: a row in the database, nothing else.
export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === 'admin'
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!isAdmin(user)) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return user
}
