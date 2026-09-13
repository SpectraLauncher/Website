import type { CatalogProjectData } from '~/types/catalog'

export interface ProjectEditorPayload {
  project: CatalogProjectData & {
    status: string
    requestedStatus?: string
    ownerId: string | null
    orgId: string | null
  }
  gallery: Array<{ id: string, url: string, title: string }>
  permissions: ProjectPermission[]
  pricing: { rateBps: number, minFeeMinor: number, minPriceMinor: number }
}

// One fetch behind every settings page, keyed by the project so the tabs share
// it and a save on one tab is seen by the next.
export function useProjectEditor(id: MaybeRefOrGetter<string>) {
  const key = computed(() => dataKeys.projectEditor(toValue(id)))

  // During SSR a plain $fetch sends no cookies, so the session is missing and the
  // author's own page comes back 401 — which the payload then carries into the
  // browser. useRequestFetch forwards the incoming request's headers; on the
  // client it is $fetch unchanged.
  const request = useRequestFetch()

  const { data, error, refresh: refetch, status } = useAsyncData(
    key.value,
    () => request<ProjectEditorPayload>(
      `/api/catalog/project/${encodeURIComponent(toValue(id))}/editor`),
    { watch: [key] },
  )

  const project = computed(() => data.value?.project ?? null)
  const permissions = computed(() => data.value?.permissions ?? [])

  const may = (permission: ProjectPermission) => permissions.value.includes(permission)

  const { invalidate } = useInvalidate()

  /**
   * Refetch the project, everywhere it is shown.
   *
   * Every settings tab calls this after a save, and a save changes more than
   * the form it came from: the public page, the member list's header and the
   * "you may edit this" answer all read the same project under their own keys.
   * Refreshing only this one left the other tab showing the old title until a
   * hard reload, which is the kind of bug people report as "it did not save".
   *
   * projectKeys covers this fetch too, so there is no separate refetch here.
   */
  const refresh = () => invalidate(projectKeys(toValue(id), project.value?.id))

  return { data, error, refresh, refetch, status, project, permissions, may }
}
