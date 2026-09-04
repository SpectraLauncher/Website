
export const SLUG_MIN = 3
export const SLUG_MAX = 64

// Slug projektu i organizacji siedzi w tej samej przestrzeni co trasy najwyzszego
// poziomu, wiec `/schematic/tools` jest bezpieczne, ale `/org/tools` juz nie —
// a jutro moze przybyc prefiks, ktory dzis nie istnieje. Lista jest wspolna dla
// obu i celowo szersza niz zbior dzisiejszych tras.
//
// Dodajac strone najwyzszego poziomu w app/pages, dopisz ja tutaj. Pilnuje tego
// test test/unit/catalog-slug.test.ts — czyta app/pages i nie przepusci nowej
// strony, ktorej tu nie ma.
const ROUTES = [
  'account', 'admin', 'badges', 'cookies', 'launcher', 'login', 'privacy',
  'reset-password', 's', 'secret', 'terms', 'tools', 'u',
]

const TYPE_PREFIXES = ['mod', 'pack', 'shader', 'resourcepack', 'schematic', 'org']

const INFRASTRUCTURE = [
  'api', 'render', '_nuxt', '_og', '_ipx', '__sitemap__', '.well-known',
  'sitemap', 'sitemap.xml', 'robots', 'robots.txt', 'llms', 'llms.txt',
  'favicon.ico', 'manifest.json', 'sw.js', 'static', 'assets', 'cdn', 'content',
]

// Slowa, ktore predzej czy pozniej beda trasa albo akcja. Taniej zablokowac je
// teraz, niz odbierac komus slug pozniej.
const RESERVED = [
  'about', 'blog', 'browse', 'create', 'dashboard', 'discover', 'docs',
  'download', 'downloads', 'edit', 'explore', 'faq', 'files', 'follow',
  'help', 'home', 'imprint', 'index', 'legal', 'me', 'messages', 'new',
  'news', 'notifications', 'organization', 'organizations', 'plugin',
  'plugins', 'profile', 'project', 'projects', 'report', 'search', 'settings',
  'signin', 'signout', 'signup', 'support', 'team', 'teams', 'upload', 'user',
  'users', 'version', 'versions', 'wiki',
]

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...ROUTES, ...TYPE_PREFIXES, ...INFRASTRUCTURE, ...RESERVED,
])

export function normalizeSlug(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
}

export type SlugProblem = 'too-short' | 'too-long' | 'reserved' | 'numeric'

// Czysto numeryczny slug zderzylby sie z wyszukiwaniem po id, ktore API v2
// dopuszcza obok sluga — `/v2/project/12` musi znaczyc jedno.
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'too-short'
  if (slug.length > SLUG_MAX) return 'too-long'
  if (/^\d+$/.test(slug)) return 'numeric'
  if (RESERVED_SLUGS.has(slug)) return 'reserved'
  return null
}

export function isUsableSlug(slug: string): boolean {
  return slugProblem(slug) === null
}
