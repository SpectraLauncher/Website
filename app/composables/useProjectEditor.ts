import type { CatalogProjectData } from '~/components/catalog/Project.vue'

export interface ProjectEditorPayload {
  project: CatalogProjectData & {
    status: string
    requestedStatus?: string
    ownerId: string | null
    orgId: string | null
  }
  gallery: Array<{ id: string, url: string, title: string, featured: boolean }>
  permissions: ProjectPermission[]
  pricing: { rateBps: number, minFeeMinor: number, minPriceMinor: number }
}

// One fetch behind every settings page, keyed by the project so the tabs share
// it and a save on one tab is seen by the next.
export function useProjectEditor(id: MaybeRefOrGetter<string>) {
  const key = computed(() => `project-editor:${toValue(id)}`)

  // During SSR a plain $fetch sends no cookies, so the session is missing and the
  // author's own page comes back 401 — which the payload then carries into the
  // browser. useRequestFetch forwards the incoming request's headers; on the
  // client it is $fetch unchanged.
  const request = useRequestFetch()

  const { data, error, refresh, status } = useAsyncData(
    key.value,
    () => request<ProjectEditorPayload>(
      `/api/catalog/project/${encodeURIComponent(toValue(id))}/editor`),
    { watch: [key] },
  )

  const project = computed(() => data.value?.project ?? null)
  const permissions = computed(() => data.value?.permissions ?? [])

  const may = (permission: ProjectPermission) => permissions.value.includes(permission)

  return { data, error, refresh, status, project, permissions, may }
}
