
import { inflateRawSync } from 'node:zlib'

// A ZIP reader for the metadata parsers. It deliberately never unpacks an
// archive — it reads the central directory and inflates only the entries someone
// asks for by name. That alone defuses most zip bombs: nobody ever asks for the
// entry that expands to a gigabyte.
//
// Written by hand rather than pulled from a library because the repo already has
// its own PNG decoder on node:zlib and this is the same class of problem, and
// because ZIP is used here in exactly one direction: reading a few named files.

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
  return fail('not a ZIP archive')
}

// Entry names come from the user file. Nothing is written to disk, so traversal
// is not a direct threat, but the name reaches the interface and the metadata —
// and an entry posing as an absolute path, or escaping its directory, is a signal
// that the archive is not what it claims to be.
export function unsafeEntryName(name: string): boolean {
  if (!name || name.length > 512) return true
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return true
  if (name.includes('\\')) return true
  if (name.split('/').includes('..')) return true
  return CONTROL.test(name)
}

export function readCentralDirectory(buf: Buffer, limits: ZipLimits = ZIP_LIMITS): ZipEntry[] {
  const eocd = findEocd(buf)

  // ZIP64 rejected outright rather than parsed wrongly in silence: its 16- and
  // 32-bit fields are saturated and the real values live in a separate record.
  //
  // ponytail: brak obslugi ZIP64. Doimplementowac, kiedy pojawi sie archiwum
  // over 4 GB or with more than 65535 entries — within a 100 MB upload that
  // cannot happen honestly.
  if (eocd >= 20 && buf.readUInt32LE(eocd - 20) === ZIP64_EOCD_LOCATOR_SIG) {
    fail('ZIP64 archives are not supported')
  }

  const total = buf.readUInt16LE(eocd + 10)
  const cdSize = buf.readUInt32LE(eocd + 12)
  const cdOffset = buf.readUInt32LE(eocd + 16)

  if (total === 0xFFFF || cdOffset === 0xFFFFFFFF || cdSize === 0xFFFFFFFF) {
    fail('ZIP64 archives are not supported')
  }
  if (total > limits.maxEntries) {
    fail(`archive has ${total} entries, over the ${limits.maxEntries} limit`)
  }
  if (cdOffset + cdSize > buf.length) fail('central directory runs past the end of the file')

  const entries: ZipEntry[] = []
  let at = cdOffset
  let totalUncompressed = 0

  for (let i = 0; i < total; i++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== CD_SIG) {
      fail('corrupt central directory')
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
      fail('archive expands to more than '
        + `${Math.round(limits.maxTotalUncompressed / 1048576)} MB`)
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset })
    at += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

function readEntry(buf: Buffer, entry: ZipEntry, limits: ZipLimits): Buffer {
  if (entry.uncompressedSize > limits.maxEntryUncompressed) {
    fail(`entry ${entry.name} expands to `
      + `${Math.round(entry.uncompressedSize / 1048576)} MB, over the `
      + `${Math.round(limits.maxEntryUncompressed / 1048576)} MB limit`)
  }
  if (entry.compressedSize > 0
    && entry.uncompressedSize / entry.compressedSize > limits.maxRatio) {
    fail(`entry ${entry.name} has a compression ratio over ${limits.maxRatio}:1`)
  }

  const head = entry.localHeaderOffset
  if (head + 30 > buf.length || buf.readUInt32LE(head) !== LOCAL_SIG) {
    fail(`corrupt local header for entry ${entry.name}`)
  }

  // The local header carries its own name and extra-field lengths, and they can
  // differ from the ones in the central directory — computing the data offset
  // from the central directory is the most common bug in hand-written ZIP readers.
  const nameLen = buf.readUInt16LE(head + 26)
  const extraLen = buf.readUInt16LE(head + 28)
  const from = head + 30 + nameLen + extraLen
  const to = from + entry.compressedSize

  if (to > buf.length) fail(`data for entry ${entry.name} runs past the end of the file`)

  const raw = buf.subarray(from, to)

  if (entry.method === 0) return Buffer.from(raw)
  if (entry.method !== 8) fail(`entry ${entry.name} uses compression method ${entry.method}`)

  // A hard ceiling on the output instead of trusting the declared size: the
  // declared size comes from the same file as the bomb.
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
    // Minecraft tolerates comments and trailing commas in its own JSON files, so
    // JSON.parse on the raw text fails on files the game itself reads without
    // blinking.
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
