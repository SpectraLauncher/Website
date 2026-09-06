
// Every article, bundled at build time. Vite's glob is eager and raw, so there
// is no request per page and no dependency on a content module.
const FILES = import.meta.glob('../content/docs/**/*.md', { eager: true, query: '?raw', import: 'default' })

function keyFor(locale: string, slug: string): string {
  return `../content/docs/${locale}/${slug}.md`
}

export function useDocContent() {
  const { locale, defaultLocale } = useI18n()

  // A page nobody has translated yet reads better in another language than as an
  // empty screen, so English stands in until it is.
  return (slug: string): string | null => {
    const wanted = FILES[keyFor(locale.value, slug)]
    if (typeof wanted === 'string') return wanted

    const fallback = FILES[keyFor(defaultLocale ?? 'en', slug)]
    return typeof fallback === 'string' ? fallback : null
  }
}
