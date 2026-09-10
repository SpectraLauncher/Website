/** The account panel's sidebar and the navigation's account menu, as one list. */
export function useAccountNav() {
  const { t } = useI18n()
  const localePath = useLocalePath()
  const session = useAuthSession()
  const { unread } = useNotifications()

  const user = computed(() => session.value.data?.user as
    { username?: string | null, role?: string | null } | undefined)

  // Hidden rather than guarded: the server already answers 404 to these routes
  // while the catalog is closed, so this only avoids linking somewhere broken.
  //
  // Both shapes count for the same reason server/utils/catalog-gate.ts accepts
  // both — the value arrives as a string when the deployment sets it, and a
  // strict comparison quietly hides the whole catalog half of the menu.
  const catalogVisible = computed(() => {
    const flag = useRuntimeConfig().public.catalogPublic
    return flag === true || flag === 'true' || user.value?.role === 'admin'
  })

  return computed<SideNavItem[]>(() =>
    accountEntries({
      signedIn: Boolean(user.value),
      username: user.value?.username,
      catalogVisible: catalogVisible.value,
    }).map(entry => ({
      id: entry.id,
      icon: entry.icon,
      label: t(entry.label),
      to: localePath(entry.path),
      badge: entry.id === 'notifications' && unread.value ? unread.value : undefined,
    })))
}
