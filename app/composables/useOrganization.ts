export interface OrgMember {
  userId: string
  role: string
  username: string | null
  name: string | null
  image: string | null
  joined: number
  permissions: OrgPermission[]
}

export interface OrgProjectCard {
  id: string
  slug: string
  type: string
  path: string
  title: string
  summary: string
  icon: string | null
  status: string
  downloads: number
  updated: number
}

export interface OrgDetails {
  id: string
  slug: string
  name: string
  logo: string | null
  summary: string
  description: string
  links: Record<string, string>
  verified: boolean
  created: number
}

export interface OrgPayload {
  org: OrgDetails
  members: OrgMember[]
  projects: OrgProjectCard[]
  role: string | null
  permissions: OrgPermission[]
  rank: number
}

// The public page and all four settings tabs read the same thing. Keying the
// request by slug is what makes them share one fetch instead of four, and what
// lets a tab refresh a change the next tab will see.
export function useOrganization(slug: MaybeRefOrGetter<string>) {
  const key = computed(() => `org:${toValue(slug)}`)

  // During SSR a plain $fetch sends no cookies, so the session is missing and the
  // author's own page comes back 401 — which the payload then carries into the
  // browser. useRequestFetch forwards the incoming request's headers; on the
  // client it is $fetch unchanged.
  const request = useRequestFetch()

  const { data, error, refresh } = useAsyncData(
    key.value,
    () => request<OrgPayload>(`/api/org/${encodeURIComponent(toValue(slug))}`),
    { watch: [key] },
  )

  const org = computed(() => data.value?.org ?? null)
  const permissions = computed(() => data.value?.permissions ?? [])

  const may = (permission: OrgPermission) => permissions.value.includes(permission)

  // Anything at all to do here. Somebody with no rights still gets the page,
  // just without a way in.
  const canManage = computed(() => permissions.value.length > 0)

  return { data, error, refresh, org, permissions, may, canManage }
}
