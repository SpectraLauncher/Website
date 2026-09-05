
export interface CollectionSummary {
  id: string
  kind: 'favourites' | 'custom'
  title: string
  projects: number
}

// The star and the Favourites row in the menu are two controls over one
// database row. Keeping them in one place is what stops them drifting apart:
// tick the row, the star lights up, and the other way round.
export function useProjectCollections(project: Ref<{ id: string, slug: string }>) {
  const collections = ref<CollectionSummary[]>([])
  const holding = ref<string[]>([])
  const loaded = ref(false)
  const favourited = ref(false)
  const busy = ref(false)

  const shelfId = computed(() =>
    collections.value.find(collection => collection.kind === 'favourites')?.id ?? null)

  async function load() {
    const res = await $fetch<{ collections: CollectionSummary[], holding: string[] }>(
      '/api/catalog/collections', { query: { holding: project.value.id } })
    collections.value = res.collections
    holding.value = res.holding
    loaded.value = true
  }

  function mark(collectionId: string, inside: boolean) {
    holding.value = inside
      ? [...new Set([...holding.value, collectionId])]
      : holding.value.filter(id => id !== collectionId)

    if (shelfId.value === collectionId) favourited.value = inside
  }

  async function setMembership(collectionId: string, inside: boolean) {
    await $fetch(`/api/catalog/collections/${collectionId}/projects`, {
      method: inside ? 'POST' : 'DELETE',
      ...(inside
        ? { body: { projectId: project.value.id } }
        : { query: { projectId: project.value.id } }),
    })
    mark(collectionId, inside)
  }

  async function toggleFavourite() {
    busy.value = true
    const next = !favourited.value
    try {
      await $fetch(`/api/catalog/project/${encodeURIComponent(project.value.slug)}/favourite`, {
        method: next ? 'POST' : 'DELETE',
      })
      favourited.value = next
      if (shelfId.value) mark(shelfId.value, next)
    }
    finally {
      busy.value = false
    }
  }

  async function createAndAdd(title: string): Promise<boolean> {
    const name = title.trim()
    if (!name) return false

    const res = await $fetch<{ collection: CollectionSummary }>('/api/catalog/collections', {
      method: 'POST',
      body: { title: name },
    })
    collections.value = [...collections.value, { ...res.collection, projects: 0 }]
    await setMembership(res.collection.id, true)
    return true
  }

  return {
    collections,
    holding,
    loaded,
    favourited,
    busy,
    shelfId,
    load,
    setMembership,
    toggleFavourite,
    createAndAdd,
  }
}
