
import type { H3Event } from 'h3'

const FALLBACK = ['patrydab4@gmail.com']

export function parseAdminEmails(raw: string): string[] {
  const configured = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return configured.length ? configured : FALLBACK
}

export function isAdminEmail(email: string | null | undefined, list: string[]): boolean {
  const value = email?.trim().toLowerCase()
  return Boolean(value && list.includes(value))
}

export function adminEmails(): string[] {
  return parseAdminEmails(String(useRuntimeConfig().adminEmails || process.env.ADMIN_EMAILS || ''))
}

export function isAdmin(user: { email?: string | null } | null | undefined): boolean {
  return isAdminEmail(user?.email, adminEmails())
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!isAdmin(user)) throw createError({ statusCode: 404, statusMessage: 'not found' })
  return user
}
