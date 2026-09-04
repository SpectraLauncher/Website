
import { randomBytes } from 'node:crypto'

// Public identifiers are random, not sequential, and that is a security property
// rather than a style choice. A project marked unlisted is one that opens by
// link but appears in no listing; with a counter for an id, walking /project/1
// upwards enumerates every one of them, and the same goes for file download
// links. Eight base62 characters is 2.2e14 possibilities, which behind the
// existing per-IP rate limits is not walkable.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export const ID_LENGTH = 8

export function newId(): string {
  let out = ''

  while (out.length < ID_LENGTH) {
    // Rejection sampling: 256 is not a multiple of 62, so taking the remainder
    // of every byte would make the first few characters slightly more likely.
    for (const byte of randomBytes(ID_LENGTH * 2)) {
      if (byte >= 248) continue
      out += ALPHABET[byte % 62]
      if (out.length === ID_LENGTH) break
    }
  }

  return out
}

export function isPublicId(value: unknown): value is string {
  return typeof value === 'string' && new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`).test(value)
}

// A slug is always lowercase, so an id carrying an uppercase letter can never be
// mistaken for one. The overlap is the roughly one in a hundred ids that come
// out all-lowercase — which is why slugs of exactly that shape are refused.
export function looksLikeId(slug: string): boolean {
  return new RegExp(`^[a-z0-9]{${ID_LENGTH}}$`).test(slug)
}
