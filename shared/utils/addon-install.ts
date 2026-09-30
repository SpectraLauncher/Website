export function addonInstallLink(slug: string): string {
  return `spectra://addon/${encodeURIComponent(slug)}`
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
