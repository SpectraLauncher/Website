
// Known outbound links, shared by user profiles and catalog projects. The key
// is stored, never the label — labels are translated in the client.
//
// To add a destination: one entry here, one icon, and the matching
// `links.<key>` string in every locale file.
export const LINK_KINDS = [
  'website',
  'source',
  'issues',
  'wiki',
  'discord',
  'donate',
  'youtube',
  'twitch',
  'github',
  'x',
  'mastodon',
  'bluesky',
] as const

export type LinkKind = typeof LINK_KINDS[number]

// The four a reader looks for before installing anything, and the ones a
// moderator checks. Everything else is where to follow the author, which is a
// different question and belongs below them.
export const PRIMARY_LINKS: readonly LinkKind[] = ['issues', 'source', 'wiki', 'discord']

export const SECONDARY_LINKS: readonly LinkKind[] =
  LINK_KINDS.filter(kind => !PRIMARY_LINKS.includes(kind))

export const LINK_ICONS: Record<LinkKind, string> = {
  website: 'i-pixelarticons-globe',
  source: 'i-pixelarticons-code',
  issues: 'i-pixelarticons-bug',
  wiki: 'i-pixelarticons-book-open',
  discord: 'i-simple-icons-discord',
  donate: 'i-pixelarticons-heart',
  youtube: 'i-simple-icons-youtube',
  twitch: 'i-simple-icons-twitch',
  github: 'i-simple-icons-github',
  x: 'i-simple-icons-x',
  mastodon: 'i-simple-icons-mastodon',
  bluesky: 'i-simple-icons-bluesky',
}

export function isLinkKind(value: unknown): value is LinkKind {
  return LINK_KINDS.includes(value as LinkKind)
}

const MAX_URL = 500

// Anything that is not http(s) is rejected outright rather than coerced. A
// stored `javascript:` or `data:` URL reaches an href and runs there, and the
// catalog is meant to take uploads from strangers.
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw || raw.length > MAX_URL) return null

  let url: URL
  try {
    url = new URL(raw)
  }
  catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname || !url.hostname.includes('.')) return null

  return url.toString().slice(0, MAX_URL)
}

// Drops unknown keys and unusable addresses instead of failing the whole save —
// a bad link is not a reason to lose the rest of an edit.
export function cleanLinks(value: unknown): Partial<Record<LinkKind, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const out: Partial<Record<LinkKind, string>> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!isLinkKind(key)) continue
    const url = safeUrl(item)
    if (url) out[key] = url
  }
  return out
}

// Icons and images we store ourselves. Unlike an outbound link these may be a
// same-origin path, because R2_PUBLIC_URL is configuration and a deployment is
// free to serve assets from the site's own origin. Everything that could carry
// script is still refused.
export function safeAssetUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw || raw.length > MAX_URL) return null

  // A protocol-relative URL borrows whatever scheme the page has and points at
  // a host we never checked, so it is not a path.
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/')) return raw

  return safeUrl(raw)
}

// An asset URL that is also safe to drop inside a CSS url(). safeAssetUrl
// vouches for the scheme and the host and percent-encodes quotes, but it leaves
// parentheses and apostrophes alone — and a bare ')' closes the url() early,
// after which the rest of the value is read as more CSS.
export function cssSafeAssetUrl(value: unknown): string | null {
  const url = safeAssetUrl(value)
  if (!url) return null

  return /["'()\\\s]/.test(url) ? null : url
}
