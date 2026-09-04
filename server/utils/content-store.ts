
import { createHash } from 'node:crypto'

import { type R2Config, r2Put, r2Size, useR2 } from './r2'

// What the Cloudflare proxy lets through, and what the legacy share.post.ts
// route already accepts.
//
// ponytail: the whole file sits in memory because readRawBody buffers. Move to a
// presigned PUT and streaming hashes once modpacks ship bundled mods, or a mod
// goes over 100 MB.
export const MAX_CONTENT_BYTES = 100 * 1024 * 1024

export interface StoredContent {
  filename: string
  size: number
  sha1: string
  sha512: string
  key: string
}

// Registry: extension -> content-type sent to R2. An allowlist, and an unknown
// extension is refused rather than stored as octet-stream: the fallback quietly
// accepts anything, which is the wrong default for a store that will one day take
// uploads from strangers. Adding a format is one line, and a deliberate one.
//
// Shape borrowed from Modrinth's project_file_type (labrinth, AGPL-3.0), plus the
// schematic formats they have no reason to carry.
const CONTENT_TYPES: Record<string, string> = {
  jar: 'application/java-archive',
  zip: 'application/zip',
  litemod: 'application/zip',
  mrpack: 'application/x-modrinth-modpack+zip',
  litematic: 'application/octet-stream',
  schem: 'application/octet-stream',
  schematic: 'application/octet-stream',
  nbt: 'application/octet-stream',
  asc: 'application/pgp-signature',
  sig: 'application/pgp-signature',
}

const MAX_FILENAME = 200

const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')

// The filename comes from the user and ends up in the R2 object key, so this is
// a trust boundary: paths, control characters and directory-escape sequences do
// not get through.
export function safeFilename(raw: string): string {
  const base = String(raw ?? '')
    .split(/[/\\]/).pop()!
    .replace(CONTROL, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_FILENAME)

  return base || 'file'
}

export function contentType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? null
}

// The key carries sha512, not sha1. sha1 has been collision-broken since 2017,
// so with open upload someone could deliberately put two different files behind
// one address; sha1 stays in the table purely as a lookup key, because that is
// what the Minecraft ecosystem identifies files by.
export function contentKey(sha512: string, filename: string): string {
  return `content/${sha512.slice(0, 2)}/${sha512}/${safeFilename(filename)}`
}

export function contentUrl(cfg: R2Config, key: string): string {
  return `${cfg.publicUrl}/${key}`
}

export function hashContent(body: Uint8Array, filename: string): StoredContent {
  const name = safeFilename(filename)
  const sha1 = createHash('sha1').update(body).digest('hex')
  const sha512 = createHash('sha512').update(body).digest('hex')

  return { filename: name, size: body.byteLength, sha1, sha512, key: contentKey(sha512, name) }
}

export function tooLarge(size: number): boolean {
  return !Number.isFinite(size) || size <= 0 || size > MAX_CONTENT_BYTES
}

// Stores a file under its content-addressed key. The same file across ten
// versions is stored once: the key is a function of the content, so an object
// already at that key is that same file and a second PUT has nothing to change.
export async function storeContent(body: Uint8Array, filename: string): Promise<StoredContent> {
  if (tooLarge(body.byteLength)) {
    throw createError({
      statusCode: 413,
      statusMessage: `file too large (max ${MAX_CONTENT_BYTES / 1048576} MB)`,
    })
  }

  const stored = hashContent(body, filename)

  const type = contentType(stored.filename)
  if (!type) {
    throw createError({
      statusCode: 415,
      statusMessage: `${stored.filename.split('.').pop()} files are not accepted`,
    })
  }

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'content storage is not configured' })

  if (await r2Size(r2, stored.key) === null) {
    await r2Put(r2, stored.key, body, type)
  }

  return stored
}

export async function contentExists(key: string, size: number): Promise<boolean> {
  const r2 = useR2()
  if (!r2) return false
  return await r2Size(r2, key) === size
}

export function publicContentUrl(key: string): string | null {
  const r2 = useR2()
  return r2 ? contentUrl(r2, key) : null
}

// Derived artefacts we generate ourselves — the schematic preview, for one — do
// not go through the upload allowlist. That list exists to refuse files someone
// hands us; this content is produced here and its type is not in question.
export async function storeDerived(
  key: string,
  body: Uint8Array | string,
  type: string,
): Promise<string | null> {
  const r2 = useR2()
  if (!r2) return null

  await r2Put(r2, key, typeof body === 'string' ? Buffer.from(body) : body, type)
  return contentUrl(r2, key)
}
