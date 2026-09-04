
import { createHash } from 'node:crypto'

import { type R2Config, r2Put, r2Size, useR2 } from './r2'

// Tyle przepuszcza proxy Cloudflare i tyle wchodzi przez legacy share.post.ts.
//
// ponytail: caly plik ladzie w pamieci, bo readRawBody buforuje. Przy modpackach
// z zapakowanymi modami albo modach ponad 100 MB przejsc na presigned PUT i
// hashowanie strumieniem.
export const MAX_CONTENT_BYTES = 100 * 1024 * 1024

export interface StoredContent {
  filename: string
  size: number
  sha1: string
  sha512: string
  key: string
}

// Rejestr: rozszerzenie -> content-type wysylany do R2. Dodanie formatu to jedna
// linia. Nieznane rozszerzenie idzie jako octet-stream, nigdy jako typ zgadniety
// z tresci — plik od uzytkownika nie decyduje o tym, jak przegladarka go potraktuje.
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

// Nazwa pliku przychodzi od uzytkownika i trafia do klucza obiektu w R2, wiec
// jest granica zaufania: sciezki, znaki sterujace i sekwencje wyjscia z katalogu
// nie moga przejsc dalej.
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

// Klucz niesie sha512, nie sha1. sha1 jest zlamany kolizyjnie od 2017 i przy
// otwartym uploadzie ktos moglby celowo podstawic dwa rozne pliki pod jeden
// adres; sha1 zostaje w tabeli wylacznie jako klucz wyszukiwania, bo tego
// wymaga ekosystem Minecrafta.
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

// Zapisuje plik pod klucz z hashem. Ten sam plik w dziesieciu wersjach lezy raz:
// klucz jest funkcja tresci, wiec istniejacy obiekt o tym kluczu jest tym samym
// plikiem i drugi PUT nie ma czego zmienic.
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
