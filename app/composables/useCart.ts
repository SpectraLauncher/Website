// The cart lives in the browser. It holds project ids and nothing else - every
// price, every rule about what may be bought, and the total are worked out by
// the server on each change, so a tampered cart buys nothing it should not.
//
// A table would make it follow people between devices. Worth adding when
// somebody asks; not worth a migration before anyone has.
const KEY = 'spectra:cart'

export interface CartLine {
  projectId: string
  slug: string
  title: string
  icon: string | null
  path: string
  priceMinor: number
}

export function useCart() {
  const items = useState<string[]>('cart', () => [])
  const loaded = useState('cart:loaded', () => false)

  // Titles and prices for whatever is in the cart. Shared state rather than a
  // fetch per component, so the navbar's popover and the cart page describe the
  // same thing and only ask once.
  const lines = useState<CartLine[]>('cart:lines', () => [])
  const totalMinor = useState('cart:total', () => 0)

  function read(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      return Array.isArray(raw) ? raw.filter(id => typeof id === 'string').slice(0, 10) : []
    }
    catch {
      // Private mode, cleared storage, a value somebody hand-edited. An empty
      // cart is the right answer to all of them.
      return []
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.value))
    }
    catch { /* storage refused; the cart still works for this page view */ }
  }

  // The endpoint is behind the catalog gate and needs a session, so it can
  // answer 404 to somebody who simply is not signed in. That is not an error
  // worth showing: the cart just describes itself as empty.
  async function reprice() {
    if (!items.value.length) {
      lines.value = []
      totalMinor.value = 0
      return
    }

    try {
      const priced = await $fetch<{ items: CartLine[], totalMinor: number }>(
        '/api/catalog/cart', { method: 'POST', body: { items: items.value } })

      lines.value = priced.items
      totalMinor.value = priced.totalMinor

      // Anything the server refused - already owned, gone, now free - is dropped
      // rather than left failing the checkout on every attempt.
      const keep = new Set(priced.items.map(item => item.projectId))
      if (keep.size !== items.value.length) {
        items.value = items.value.filter(id => keep.has(id))
        persist()
      }
    }
    catch {
      lines.value = []
      totalMinor.value = 0
    }
  }

  onMounted(() => {
    if (!loaded.value) {
      items.value = read()
      loaded.value = true
    }
    if (items.value.length && !lines.value.length) void reprice()
  })

  const has = (id: string) => items.value.includes(id)

  function add(id: string) {
    if (!id || has(id)) return
    items.value = [...items.value, id].slice(0, 10)
    persist()
    void reprice()
  }

  function remove(id: string) {
    items.value = items.value.filter(item => item !== id)
    persist()
    void reprice()
  }

  function clear() {
    items.value = []
    lines.value = []
    totalMinor.value = 0
    persist()
  }

  return {
    items,
    lines,
    totalMinor,
    has,
    add,
    remove,
    clear,
    reprice,
    count: computed(() => items.value.length),
  }
}
