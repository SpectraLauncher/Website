// One list behind both the account panel's sidebar and the navigation's account
// menu. They drifted apart twice before this existed: the menu gained "My
// reports" and the panel did not, and /library reached the menu a release later
// than the page.
//
// To add an entry: a line in ENTRIES, a key under nav.account, and — if the page
// is part of the catalog — `catalog: true`, which hides it while the catalog is
// closed to everyone but the admin.
interface AccountEntry {
  id: string
  icon: string
  label: string
  path: string | ((username: string) => string)
  catalog?: boolean
}

const ENTRIES: AccountEntry[] = [
  { id: 'profile', icon: 'i-pixelarticons-user', label: 'nav.account.profile', path: name => `/u/${name}` },
  { id: 'notifications', icon: 'i-pixelarticons-bell', label: 'nav.account.notifications', path: '/notifications' },
  { id: 'projects', icon: 'i-pixelarticons-package', label: 'nav.account.projects', path: '/projects', catalog: true },
  { id: 'collections', icon: 'i-pixelarticons-bookmark', label: 'nav.account.collections', path: '/collections', catalog: true },
  { id: 'organizations', icon: 'i-pixelarticons-users', label: 'nav.account.organizations', path: '/organizations', catalog: true },
  { id: 'library', icon: 'i-pixelarticons-library', label: 'nav.account.library', path: '/library', catalog: true },
  { id: 'analytics', icon: 'i-pixelarticons-chart-line', label: 'nav.account.analytics', path: '/analytics', catalog: true },
  { id: 'revenue', icon: 'i-pixelarticons-chart', label: 'nav.account.revenue', path: '/revenue', catalog: true },
  { id: 'seller', icon: 'i-pixelarticons-wallet', label: 'nav.account.seller', path: '/seller', catalog: true },
  { id: 'reports', icon: 'i-pixelarticons-flag', label: 'reports.mine', path: '/reports', catalog: true },
  { id: 'settings', icon: 'i-pixelarticons-gear', label: 'nav.account.settings', path: '/settings' },
]

export function useAccountNav() {
  const { t } = useI18n()
  const localePath = useLocalePath()
  const session = useAuthSession()
  const { unread } = useNotifications()

  const user = computed(() => session.value.data?.user as { username?: string, role?: string } | undefined)

  // Hidden rather than guarded: the server already answers 404 to these routes
  // while the catalog is closed, so this only avoids linking somewhere broken.
  const catalogVisible = computed(() =>
    useRuntimeConfig().public.catalogPublic === true || user.value?.role === 'admin')

  return computed<SideNavItem[]>(() => {
    const name = user.value?.username
    if (!name) return []

    return ENTRIES
      .filter(entry => !entry.catalog || catalogVisible.value)
      .map(entry => ({
        id: entry.id,
        icon: entry.icon,
        label: t(entry.label),
        to: localePath(typeof entry.path === 'function' ? entry.path(name) : entry.path),
        badge: entry.id === 'notifications' && unread.value ? unread.value : undefined,
      }))
  })
}
