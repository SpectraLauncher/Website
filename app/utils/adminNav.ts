import type { StaffRole } from '~~/shared/utils/staff-roles'

export interface AdminNavEntry {
  id: string
  icon: string
  label: string
  group: string
  /** Absent for a section that lives as a tab on /admin itself. */
  to?: string
  /** The lowest role the section is offered to. */
  need: StaffRole
}

/**
 * Every section of the panel, in one list.
 *
 * The layout draws it and /admin switches tabs with it, so a section is a line
 * here and nothing else has to be told. Leaving an entry out is not what
 * protects it — every route checks again — it is what stops the panel offering
 * a moderator a door that answers 404.
 *
 * To add a section: one entry here, plus its page (with `to`) or a branch in
 * the body of /admin.
 */
export const ADMIN_NAV: readonly AdminNavEntry[] = [
  { id: 'overview', icon: 'i-pixelarticons-dashboard', label: 'Przegląd', group: 'Platforma', need: 'admin' },
  { id: 'telemetry', icon: 'i-pixelarticons-chart-bar', label: 'Telemetria', group: 'Platforma', need: 'admin' },
  { id: 'finance', icon: 'i-pixelarticons-coin', label: 'Finanse', group: 'Platforma', to: '/admin/finance', need: 'admin' },
  { id: 'audit', icon: 'i-pixelarticons-list', label: 'Dziennik', group: 'Platforma', to: '/admin/audit', need: 'admin' },
  { id: 'settings', icon: 'i-pixelarticons-sliders', label: 'Ustawienia', group: 'Platforma', to: '/admin/settings', need: 'admin' },

  { id: 'catalog', icon: 'i-pixelarticons-package', label: 'Katalog', group: 'Treść', to: '/admin/catalog', need: 'moderator' },
  { id: 'verification', icon: 'i-pixelarticons-check-double', label: 'Weryfikacja', group: 'Treść', to: '/admin/verification', need: 'moderator' },
  { id: 'shares', icon: 'i-pixelarticons-archive', label: 'Paczki', group: 'Treść', need: 'admin' },
  { id: 'posts', icon: 'i-pixelarticons-article', label: 'Artykuły', group: 'Treść', to: '/admin/posts', need: 'admin' },
  { id: 'newsletter', icon: 'i-pixelarticons-mail', label: 'Newsletter', group: 'Treść', to: '/admin/posts?kind=newsletter', need: 'admin' },

  { id: 'users', icon: 'i-pixelarticons-users', label: 'Użytkownicy', group: 'Ludzie', need: 'admin' },
  { id: 'badges', icon: 'i-pixelarticons-trophy', label: 'Odznaki', group: 'Ludzie', need: 'admin' },

  { id: 'discord', icon: 'i-simple-icons-discord', label: 'Discord', group: 'Integracje', need: 'admin' },
]

/** Which entry a path belongs to, so no page has to name itself twice. */
export function adminNavCurrent(path: string, query: Record<string, unknown> = {}): string {
  const here = path.replace(/\/$/, '')

  // /admin/posts serves both kinds; ?kind is what tells them apart.
  if (here.endsWith('/admin/posts')) {
    return query.kind === 'newsletter' ? 'newsletter' : 'posts'
  }

  return ADMIN_NAV.find(entry => entry.to && here.endsWith(entry.to.split('?')[0]!))?.id ?? ''
}
