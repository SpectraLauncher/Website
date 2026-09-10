// One list behind both the account panel's sidebar and the navigation's account
// menu. They drifted apart twice before this existed: the menu gained "My
// reports" and the panel did not, and /library reached the menu a release later
// than the page.
//
// To add an entry: a line in ACCOUNT_ENTRIES, a key under nav.account, and — if
// the page belongs to the catalog — `catalog: true`, which hides it while the
// catalog is closed to everyone but the admin.
export interface AccountEntry {
  id: string
  icon: string
  /** An i18n key, resolved by the caller. */
  label: string
  /** A function when the address is built from the username. */
  path: string | ((username: string) => string)
  catalog?: boolean
}

export const ACCOUNT_ENTRIES: AccountEntry[] = [
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

export interface AccountViewer {
  signedIn: boolean
  username?: string | null
  /** Whether catalog routes answer for this viewer. See server/utils/catalog-gate.ts. */
  catalogVisible: boolean
}

/**
 * The entries a given viewer should see, each with its address resolved.
 *
 * Only the profile entry is built from a username, and an account can be signed
 * in without having picked one — dropping the whole panel over that is what
 * emptied the account menu once already.
 */
export function accountEntries(viewer: AccountViewer): Array<AccountEntry & { path: string }> {
  if (!viewer.signedIn) return []

  const name = viewer.username

  return ACCOUNT_ENTRIES
    .filter(entry => typeof entry.path === 'string' || Boolean(name))
    .filter(entry => !entry.catalog || viewer.catalogVisible)
    .map(entry => ({
      ...entry,
      path: typeof entry.path === 'function' ? entry.path(name!) : entry.path,
    }))
}
