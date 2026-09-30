export function launcherRequirement(meta: Record<string, unknown> | null | undefined): { range: string | null } | null {
  if (!meta || typeof meta.addonId !== 'string') return null
  const range = typeof meta.launcher === 'string' ? meta.launcher.trim() : ''
  return { range: range || null }
}

export function addonInstallLink(slug: string): string {
  return `spectra://addon/${encodeURIComponent(slug)}`
}

export const ADDON_REVIEW_ITEMS = ['permissions', 'network', 'code', 'backend'] as const
export type AddonReviewItem = typeof ADDON_REVIEW_ITEMS[number]

export function addonReviewDone(ticked: unknown): boolean {
  return Array.isArray(ticked) && ADDON_REVIEW_ITEMS.every(item => ticked.includes(item))
}

const stringsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])

export function newAddonAsks(
  approved: ReadonlyArray<Record<string, unknown> | null | undefined>,
  next: Record<string, unknown> | null | undefined,
): string[] {
  const had = new Set(approved.flatMap(meta => stringsOf(meta?.permissions)))
  const asks = stringsOf(next?.permissions).filter(permission => !had.has(permission))
  if (next?.backend && !approved.some(meta => meta?.backend)) asks.push('backend')
  return asks
}

export interface AddonAccess {
  permissions: string[]
  hosts: string[]
  runsCode: boolean
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function permissionKey(permission: string): string {
  return permission.replace(/:(\w)/, (_, c: string) => c.toUpperCase())
}

export function addonAccess(meta: Record<string, unknown> | null | undefined): AddonAccess {
  const permissions = listOf(meta?.permissions).filter((p): p is string => typeof p === 'string')
  const contributes = (meta?.contributes ?? {}) as Record<string, unknown>

  const runsCode = Boolean(meta?.main) || Boolean(meta?.backend)
    || listOf(contributes.pages).length > 0
    || listOf(contributes.instanceTabs).length > 0
    || Boolean(contributes.settings)
    || listOf(contributes.windows).length > 0
    || listOf(contributes.buttons).some(b => (b as { action?: { type?: unknown } })?.action?.type !== 'url')

  return {
    permissions: permissions.filter(p => !p.startsWith('network:')),
    hosts: permissions.filter(p => p.startsWith('network:')).map(p => p.slice('network:'.length)),
    runsCode,
  }
}
