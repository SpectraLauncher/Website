// Public identifiers are random, not sequential, and that is a security property
// rather than a style choice. A project marked unlisted is one that opens by
// link but appears in no listing; with a counter for an id, walking /project/1
// upwards enumerates every one of them, and the same goes for file download
// links. Eight base62 characters is 2.2e14 possibilities, which behind the
// existing per-IP rate limits is not walkable.
//
// The shape lives here rather than beside newId() because the browser has to
// recognise an id too — a slug field cannot warn about a collision it cannot
// see — and newId() needs node:crypto, which has no business in the bundle.
export const ID_LENGTH = 8

export function isPublicId(value: unknown): value is string {
  return typeof value === 'string' && new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`).test(value)
}

// A slug is always lowercase, so an id carrying an uppercase letter can never be
// mistaken for one. The overlap is the roughly one in a hundred ids that come
// out all-lowercase — which is why slugs of exactly that shape are refused.
export function looksLikeId(slug: string): boolean {
  return new RegExp(`^[a-z0-9]{${ID_LENGTH}}$`).test(slug)
}
