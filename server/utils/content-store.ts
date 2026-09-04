
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

// Registry: extension -> content-type sent to R2. Adding a format is one line.
// An unknown extension goes out as octet-stream and never as a type sniffed from
// the bytes — a user file does not get to decide how a browser treats it.
const CONTENT_TYPES: Record<string, string> = {
  jar: 'application/java-archive',
  zip: 'application/zip',
  mrpack: 'application/zip',
  litematic: 'application/octet-stream',
  schem: 'application/octet-stream',
  schematic: 'application/octet-stream',
  nbt: 'application/octet-stream',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
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

export function contentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
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

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'content storage is not configured' })

  const stored = hashContent(body, filename)

  if (await r2Size(r2, stored.key) === null) {
    await r2Put(r2, stored.key, body, contentType(stored.filename))
  }

  return stored
}
