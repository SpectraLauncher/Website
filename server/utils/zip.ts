
import { inflateRawSync } from 'node:zlib'

// Czytnik ZIP-a pod parsery metadanych. Celowo nie rozpakowuje archiwum — czyta
// centralny katalog i inflatuje wylacznie te wpisy, o ktore ktos poprosi po
// nazwie. To samo z siebie zabija wiekszosc zip bombow: nikt nigdy nie prosi o
// wpis, ktory rozwija sie do gigabajta.
//
// Piszemy to recznie zamiast brac biblioteke, bo repo ma juz wlasny dekoder PNG
// na node:zlib i to jest ta sama klasa problemu, a formatu ZIP uzywamy w
// dokladnie jednym kierunku: odczyt kilku nazwanych plikow.

const CONTROL = new RegExp('[\u0000-\u001F\u007F]')

const EOCD_SIG = 0x06054B50
const CD_SIG = 0x02014B50
const LOCAL_SIG = 0x04034B50
const ZIP64_EOCD_LOCATOR_SIG = 0x07064B50

const EOCD_MIN = 22
const MAX_COMMENT = 0xFFFF

export interface ZipLimits {
  maxEntries: number
  maxTotalUncompressed: number
  maxEntryUncompressed: number
  maxRatio: number
}

export const ZIP_LIMITS: ZipLimits = {
  maxEntries: 20_000,
  maxTotalUncompressed: 512 * 1024 * 1024,
  maxEntryUncompressed: 16 * 1024 * 1024,
  maxRatio: 200,
}

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

export class ZipError extends Error {}

function fail(message: string): never {
  throw new ZipError(message)
}

function findEocd(buf: Buffer): number {
  const start = Math.max(0, buf.length - (EOCD_MIN + MAX_COMMENT))
  for (let i = buf.length - EOCD_MIN; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return fail('to nie jest archiwum ZIP')
}

// Nazwa wpisu pochodzi z pliku od uzytkownika. Nie zapisujemy nic na dysk, wiec
// traversal nam nie grozi bezposrednio, ale nazwa trafia do interfejsu i do
// metadanych — a wpis udajacy sciezke absolutna albo wychodzacy z katalogu jest
// sygnalem, ze archiwum nie jest tym, za co sie podaje.
export function unsafeEntryName(name: string): boolean {
  if (!name || name.length > 512) return true
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return true
  if (name.includes('\\')) return true
  if (name.split('/').includes('..')) return true
  return CONTROL.test(name)
}

export function readCentralDirectory(buf: Buffer, limits: ZipLimits = ZIP_LIMITS): ZipEntry[] {
  const eocd = findEocd(buf)

  // ZIP64 zamiast cichego zlego parsowania: pola 16- i 32-bitowe sa wtedy
  // wysycone, a prawdziwe wartosci leza w osobnym rekordzie.
  //
  // ponytail: brak obslugi ZIP64. Doimplementowac, kiedy pojawi sie archiwum
  // ponad 4 GB albo z ponad 65535 wpisami — do 100 MB uploadu to nie moze sie
  // zdarzyc uczciwie.
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === ZIP64_EOCD_LOCATOR_SIG) {
    fail('archiwa ZIP64 nie sa obslugiwane')
  }

  const total = buf.readUInt16LE(eocd + 10)
  const cdSize = buf.readUInt32LE(eocd + 12)
  const cdOffset = buf.readUInt32LE(eocd + 16)

  if (total === 0xFFFF || cdOffset === 0xFFFFFFFF || cdSize === 0xFFFFFFFF) {
    fail('archiwa ZIP64 nie sa obslugiwane')
  }
  if (total > limits.maxEntries) {
    fail(`archiwum ma ${total} wpisow, limit to ${limits.maxEntries}`)
  }
  if (cdOffset + cdSize > buf.length) fail('centralny katalog wychodzi poza plik')

  const entries: ZipEntry[] = []
  let at = cdOffset
  let totalUncompressed = 0

  for (let i = 0; i < total; i++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== CD_SIG) {
      fail('uszkodzony centralny katalog')
    }

    const method = buf.readUInt16LE(at + 10)
    const compressedSize = buf.readUInt32LE(at + 20)
    const uncompressedSize = buf.readUInt32LE(at + 24)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const localHeaderOffset = buf.readUInt32LE(at + 42)

    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)

    totalUncompressed += uncompressedSize
    if (totalUncompressed > limits.maxTotalUncompressed) {
      fail('archiwum rozwija sie do wiecej niz '
        + `${Math.round(limits.maxTotalUncompressed / 1048576)} MB`)
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset })
    at += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

function readEntry(buf: Buffer, entry: ZipEntry, limits: ZipLimits): Buffer {
  if (entry.uncompressedSize > limits.maxEntryUncompressed) {
    fail(`wpis ${entry.name} rozwija sie do `
      + `${Math.round(entry.uncompressedSize / 1048576)} MB, limit to `
      + `${Math.round(limits.maxEntryUncompressed / 1048576)} MB`)
  }
  if (entry.compressedSize > 0
    && entry.uncompressedSize / entry.compressedSize > limits.maxRatio) {
    fail(`wpis ${entry.name} ma wspolczynnik kompresji ponad ${limits.maxRatio}:1`)
  }

  const head = entry.localHeaderOffset
  if (head + 30 > buf.length || buf.readUInt32LE(head) !== LOCAL_SIG) {
    fail(`uszkodzony naglowek wpisu ${entry.name}`)
  }

  // Naglowek lokalny ma wlasne dlugosci nazwy i pola extra i potrafia sie roznic
  // od tych z centralnego katalogu — liczenie offsetu danych z centralnego jest
  // najczestszym bledem w recznych czytnikach ZIP-a.
  const nameLen = buf.readUInt16LE(head + 26)
  const extraLen = buf.readUInt16LE(head + 28)
  const from = head + 30 + nameLen + extraLen
  const to = from + entry.compressedSize

  if (to > buf.length) fail(`dane wpisu ${entry.name} wychodza poza plik`)

  const raw = buf.subarray(from, to)

  if (entry.method === 0) return Buffer.from(raw)
  if (entry.method !== 8) fail(`wpis ${entry.name} uzywa metody kompresji ${entry.method}`)

  // Twardy sufit na wyjsciu zamiast wiary w zadeklarowany rozmiar: zadeklarowany
  // rozmiar pochodzi z tego samego pliku co bomba.
  return inflateRawSync(raw, { maxOutputLength: limits.maxEntryUncompressed })
}

export interface Zip {
  entries: ZipEntry[]
  has: (name: string) => boolean
  read: (name: string) => Buffer | null
  readText: (name: string) => string | null
  readJson: <T = unknown>(name: string) => T | null
}

export function openZip(body: Uint8Array, limits: ZipLimits = ZIP_LIMITS): Zip {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
  const entries = readCentralDirectory(buf, limits)
  const byName = new Map(entries.map(e => [e.name, e]))

  const read = (name: string) => {
    const entry = byName.get(name)
    return entry ? readEntry(buf, entry, limits) : null
  }

  const readText = (name: string) => read(name)?.toString('utf8') ?? null

  return {
    entries,
    has: name => byName.has(name),
    read,
    readText,
    // Minecraft przepuszcza w swoich plikach JSON komentarze i przecinek przed
    // klamra, wiec JSON.parse na surowej tresci wywala sie na plikach, ktore gra
    // wczytuje bez mrugniecia.
    readJson: <T = unknown>(name: string): T | null => {
      const text = readText(name)
      return text === null ? null : (JSON.parse(relaxJson(text)) as T)
    },
  }
}

export function relaxJson(text: string): string {
  let out = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!

    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
      continue
    }
    out += ch
  }

  return out.replace(/,(\s*[}\]])/g, '$1')
}
