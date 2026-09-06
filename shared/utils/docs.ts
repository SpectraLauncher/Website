
// The manual, in order. The slug is the address and the file name; the title and
// the summary come from the locale files, so a page is written once and
// translated like everything else.
//
// To add a page: an entry here, a markdown file per language under
// app/content/docs/<locale>/<slug>.md, and `docs.pages.<slug>` strings.
export const DOC_SECTIONS = [
  {
    id: 'start',
    icon: 'i-lucide-compass',
    pages: ['what-is-spectra', 'account', 'launcher'],
  },
  {
    id: 'content',
    icon: 'i-lucide-package',
    pages: ['project-types', 'finding-content', 'collections'],
  },
  {
    id: 'authors',
    icon: 'i-lucide-pen-line',
    pages: ['publishing', 'versions', 'organizations', 'disclosures'],
  },
  {
    id: 'rules',
    icon: 'i-lucide-scale',
    pages: ['moderation', 'reporting'],
  },
  {
    id: 'money',
    icon: 'i-lucide-wallet',
    pages: ['selling', 'payouts'],
  },
  {
    id: 'developers',
    icon: 'i-lucide-code',
    pages: ['api-tokens', 'oauth', 'rate-limits'],
  },
] as const

export type DocSection = typeof DOC_SECTIONS[number]['id']

export const DOC_PAGES = DOC_SECTIONS.flatMap(section => section.pages) as readonly string[]

export function isDocPage(value: unknown): value is string {
  return typeof value === 'string' && DOC_PAGES.includes(value)
}

export function sectionOf(slug: string): DocSection | null {
  return DOC_SECTIONS.find(s => (s.pages as readonly string[]).includes(slug))?.id ?? null
}

// Previous and next across the whole manual, so a reader can work through it
// without going back to the index every time.
export function neighbours(slug: string): { previous: string | null, next: string | null } {
  const index = DOC_PAGES.indexOf(slug)
  if (index < 0) return { previous: null, next: null }

  return {
    previous: DOC_PAGES[index - 1] ?? null,
    next: DOC_PAGES[index + 1] ?? null,
  }
}
