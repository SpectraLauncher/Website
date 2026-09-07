// The cart lives in the browser. It holds project ids and nothing else - every
// price, every rule about what may be bought, and the total are worked out by
// the server on each change, so a tampered cart buys nothing it should not.
//
// A table would make it follow people between devices. Worth adding when
// somebody asks; not worth a migration before anyone has.
const KEY = 'spectra:cart'

export function useCart() {
  const items = useState<string[]>('cart', () => [])
  const loaded = useState('cart:loaded', () => false)

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

  onMounted(() => {
    if (loaded.value) return
    items.value = read()
    loaded.value = true
  })

  const has = (id: string) => items.value.includes(id)

  function add(id: string) {
    if (!id || has(id)) return
    items.value = [...items.value, id].slice(0, 10)
    persist()
  }

  function remove(id: string) {
    items.value = items.value.filter(item => item !== id)
    persist()
  }

  function clear() {
    items.value = []
    persist()
  }

  return { items, has, add, remove, clear, count: computed(() => items.value.length) }
}
