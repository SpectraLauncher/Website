
import { looksLikeId } from './ids'

export const SLUG_MIN = 3
export const SLUG_MAX = 64

// Project and organization slugs share a namespace with the top-level routes,
// so `/schematic/tools` is safe but `/org/tools` is not — and tomorrow may bring
// a prefix that does not exist today. One list covers both, deliberately wider
// than the set of routes that exist right now.
//
// When adding a top-level page under app/pages, add it here too. The test in
// test/unit/catalog-slug.test.ts reads app/pages and will not let a new page
// through if it is missing from this list.
const ROUTES = [
  'account', 'admin', 'badges', 'cookies', 'launcher', 'login', 'privacy',
  'reset-password', 's', 'secret', 'seller', 'terms', 'tools', 'u', 'verification',
]

const TYPE_PREFIXES = ['mod', 'pack', 'shader', 'resourcepack', 'schematic', 'org']

const INFRASTRUCTURE = [
  'api', 'render', '_nuxt', '_og', '_ipx', '__sitemap__', '.well-known',
  'sitemap', 'sitemap.xml', 'robots', 'robots.txt', 'llms', 'llms.txt',
  'favicon.ico', 'manifest.json', 'sw.js', 'static', 'assets', 'cdn', 'content',
]

// Words that will sooner or later become a route or an action. Cheaper to block
// them now than to take a slug away from someone later.
const RESERVED = [
  'about', 'blog', 'browse', 'create', 'dashboard', 'discover', 'docs',
  'download', 'downloads', 'edit', 'explore', 'faq', 'files', 'follow',
  'help', 'home', 'imprint', 'index', 'invite', 'invites', 'legal', 'library', 'me',
  'messages', 'new',
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

export type SlugProblem = 'too-short' | 'too-long' | 'reserved' | 'numeric' | 'id-shaped'

// A slug has to be distinguishable from an id, because the v2 API and
// /project/<id> both accept either on the same path.
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'too-short'
  if (slug.length > SLUG_MAX) return 'too-long'
  if (/^\d+$/.test(slug)) return 'numeric'
  // Reserved is checked first because it is the more useful answer: "launcher"
  // happens to be eight lowercase characters, and telling someone it collides
  // with a route helps more than telling them it looks like an id.
  if (RESERVED_SLUGS.has(slug)) return 'reserved'
  // /project/<id> accepts an id or a slug on the same path, so a slug shaped
  // like an id would make that path ambiguous.
  if (looksLikeId(slug)) return 'id-shaped'
  return null
}

export function isUsableSlug(slug: string): boolean {
  return slugProblem(slug) === null
}
