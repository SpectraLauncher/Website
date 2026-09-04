
import { gunzipSync, inflateSync } from 'node:zlib'

// An NBT reader. Every schematic format supported here is gzipped NBT — what
// separates them is the tag layout inside, not the encoding.
//
// Big-endian, because that is the Java format. Every read checks the buffer
// bounds: the file comes from the user, and a length written inside it is
// exactly as untrusted as the rest of it.

export const TAG_END = 0
export const TAG_BYTE = 1
export const TAG_SHORT = 2
export const TAG_INT = 3
export const TAG_LONG = 4
export const TAG_FLOAT = 5
export const TAG_DOUBLE = 6
export const TAG_BYTE_ARRAY = 7
export const TAG_STRING = 8
export const TAG_LIST = 9
export const TAG_COMPOUND = 10
export const TAG_INT_ARRAY = 11
export const TAG_LONG_ARRAY = 12

export type NbtValue =
  | number
  | bigint
  | string
  | Int8Array
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | NbtCompound

export interface NbtCompound { [key: string]: NbtValue }

export class NbtError extends Error {}

// Nesting is a cheap weapon: a few kilobytes of lists that only ever open are
// enough to blow the stack of a recursive reader.
const MAX_DEPTH = 512

// A depth limit alone is not enough: a flat file with millions of tiny tags
// walks straight through it and eats memory on the objects alone.
const MAX_TAGS = 8 * 1024 * 1024

const MAX_DECOMPRESSED = 256 * 1024 * 1024

function fail(message: string): never {
  throw new NbtError(message)
}

export function decompressNbt(body: Uint8Array): Buffer {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
  if (buf.length < 3) fail('file is too short to be NBT')

  if (buf[0] === 0x1F && buf[1] === 0x8B) {
    return gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED })
  }
  // zlib header: first byte 0x78, and (CMF*256 + FLG) divisible by 31.
  if (buf[0] === 0x78 && ((buf[0]! << 8) + buf[1]!) % 31 === 0) {
    return inflateSync(buf, { maxOutputLength: MAX_DECOMPRESSED })
  }
  return buf
}

class Reader {
  private tags = 0

  constructor(private buf: Buffer, private at = 0) {}

  private tag() {
    if (++this.tags > MAX_TAGS) fail('NBT has more tags than the limit allows')
  }

  private need(bytes: number) {
    if (this.at + bytes > this.buf.length) fail('NBT ends in the middle of a value')
  }

  u8() {
    this.need(1)
    return this.buf.readUInt8(this.at++)
  }

  i8() {
    this.need(1)
    return this.buf.readInt8(this.at++)
  }

  i16() {
    this.need(2)
    const v = this.buf.readInt16BE(this.at)
    this.at += 2
    return v
  }

  i32() {
    this.need(4)
    const v = this.buf.readInt32BE(this.at)
    this.at += 4
    return v
  }

  i64() {
    this.need(8)
    const v = this.buf.readBigInt64BE(this.at)
    this.at += 8
    return v
  }

  f32() {
    this.need(4)
    const v = this.buf.readFloatBE(this.at)
    this.at += 4
    return v
  }

  f64() {
    this.need(8)
    const v = this.buf.readDoubleBE(this.at)
    this.at += 8
    return v
  }

  str() {
    this.need(2)
    const len = this.buf.readUInt16BE(this.at)
    this.at += 2
    this.need(len)
    const v = this.buf.toString('utf8', this.at, this.at + len)
    this.at += len
    return v
  }

  // The array length is written in the file, so before allocating we check that
  // this many bytes are even left — otherwise a declared two billion elements
  // tries to allocate memory that is not there.
  count(itemBytes: number) {
    const n = this.i32()
    if (n < 0) fail('NBT declares an array of negative length')
    if (this.at + n * itemBytes > this.buf.length) {
      fail('NBT declares an array longer than the file itself')
    }
    return n
  }

  value(type: number, depth: number): NbtValue {
    if (depth > MAX_DEPTH) fail('NBT is nested deeper than the limit')
    this.tag()

    switch (type) {
      case TAG_BYTE: return this.i8()
      case TAG_SHORT: return this.i16()
      case TAG_INT: return this.i32()
      case TAG_LONG: return this.i64()
      case TAG_FLOAT: return this.f32()
      case TAG_DOUBLE: return this.f64()
      case TAG_STRING: return this.str()

      case TAG_BYTE_ARRAY: {
        const n = this.count(1)
        const out = new Int8Array(n)
        for (let i = 0; i < n; i++) out[i] = this.buf.readInt8(this.at + i)
        this.at += n
        return out
      }

      case TAG_INT_ARRAY: {
        const n = this.count(4)
        const out = new Int32Array(n)
        for (let i = 0; i < n; i++) out[i] = this.buf.readInt32BE(this.at + i * 4)
        this.at += n * 4
        return out
      }

      case TAG_LONG_ARRAY: {
        const n = this.count(8)
        const out = new BigInt64Array(n)
        for (let i = 0; i < n; i++) out[i] = this.buf.readBigInt64BE(this.at + i * 8)
        this.at += n * 8
        return out
      }

      case TAG_LIST: {
        const itemType = this.u8()
        const n = this.count(1)
        const out: NbtValue[] = []
        // TAG_End as the element type means "empty list". Some writers pair it
        // with a non-zero length anyway, and then there is nothing to read.
        if (itemType === TAG_END) return out
        for (let i = 0; i < n; i++) out.push(this.value(itemType, depth + 1))
        return out
      }

      case TAG_COMPOUND: {
        const out: NbtCompound = {}
        for (;;) {
          const tag = this.u8()
          if (tag === TAG_END) return out
          const key = this.str()
          out[key] = this.value(tag, depth + 1)
        }
      }

      default:
        return fail(`unknown NBT tag: ${type}`)
    }
  }
}

export interface NbtRoot { name: string, value: NbtCompound }

export function readNbt(body: Uint8Array): NbtRoot {
  const buf = decompressNbt(body)
  const reader = new Reader(buf)

  const tag = reader.u8()
  if (tag !== TAG_COMPOUND) fail('NBT does not start with a compound tag')

  const name = reader.str()
  return { name, value: reader.value(TAG_COMPOUND, 0) as NbtCompound }
}

// --- typed reads ---------------------------------------------------------
// NBT has no schema, so any read from a user file may return something other
// than what we expect. These return undefined rather than throwing, so each
// format parser decides for itself what is an error and what is a missing field.

export function asCompound(v: NbtValue | undefined): NbtCompound | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v)
    ? v as NbtCompound
    : undefined
}

export function asList(v: NbtValue | undefined): NbtValue[] | undefined {
  return Array.isArray(v) ? v : undefined
}

export function asString(v: NbtValue | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function asNumber(v: NbtValue | undefined): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  return undefined
}

export function asIntArray(v: NbtValue | undefined): Int32Array | undefined {
  return v instanceof Int32Array ? v : undefined
}

export function asLongArray(v: NbtValue | undefined): BigInt64Array | undefined {
  return v instanceof BigInt64Array ? v : undefined
}

export function asByteArray(v: NbtValue | undefined): Int8Array | undefined {
  return v instanceof Int8Array ? v : undefined
}
