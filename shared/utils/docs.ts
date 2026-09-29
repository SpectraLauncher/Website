
// The manual, in order. The slug is the address and the file name; the title and
// the summary come from the locale files, so a page is written once and
// translated like everything else.
//
// To add a page: an entry here, a markdown file per language under
// app/content/docs/<locale>/<slug>.md, and `docs.pages.<slug>` strings.
export const DOC_SECTIONS = [
  {
    id: 'start',
    icon: 'i-pixelarticons-compass',
    pages: ['what-is-spectra', 'account', 'launcher'],
  },
  {
    id: 'content',
    icon: 'i-pixelarticons-package',
    pages: ['project-types', 'finding-content', 'collections'],
  },
  {
    id: 'authors',
    icon: 'i-pixelarticons-edit',
    pages: ['publishing', 'versions', 'organizations', 'disclosures'],
  },
  {
    id: 'rules',
    icon: 'i-pixelarticons-scale',
    pages: ['moderation', 'reporting'],
  },
  {
    id: 'developers',
    icon: 'i-pixelarticons-code',
    pages: ['api-tokens', 'oauth', 'rate-limits'],
  },
] as const

export type DocSection = typeof DOC_SECTIONS[number]['id']

export const DOC_PAGES = DOC_SECTIONS.flatMap(section => section.pages) as readonly string[]

export const CATALOG_DOC_PAGES: readonly string[] = [
  'what-is-spectra', 'project-types', 'finding-content', 'collections',
  'publishing', 'versions', 'organizations', 'disclosures', 'moderation', 'reporting',
]

export function docSections(catalogOpen: boolean) {
  return DOC_SECTIONS
    .map(section => ({
      ...section,
      pages: section.pages.filter(page => catalogOpen || !CATALOG_DOC_PAGES.includes(page)),
    }))
    .filter(section => section.pages.length)
}

export function docPages(catalogOpen: boolean): readonly string[] {
  return docSections(catalogOpen).flatMap(section => section.pages)
}

export function sectionOf(slug: string): DocSection | null {
  return DOC_SECTIONS.find(s => (s.pages as readonly string[]).includes(slug))?.id ?? null
}

// Previous and next across the whole manual, so a reader can work through it
// without going back to the index every time.
export function neighbours(
  slug: string,
  pages: readonly string[] = DOC_PAGES,
): { previous: string | null, next: string | null } {
  const index = pages.indexOf(slug)
  if (index < 0) return { previous: null, next: null }

  return {
    previous: pages[index - 1] ?? null,
    next: pages[index + 1] ?? null,
  }
}
