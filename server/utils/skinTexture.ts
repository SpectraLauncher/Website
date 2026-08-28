import { LEGACY_COPIES, SKIN_SIZE, isLegacySkin, stripLegacyHat } from '~/utils/skin'

import { inflateSync } from 'node:zlib'

interface Decoded { data: Uint8ClampedArray, width: number, height: number }

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodePng(buffer: Buffer): Decoded | null {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504E47) return null

  let offset = 8
  let width = 0
  let height = 0
  let depth = 0
  let colour = 0
  let palette: Buffer | null = null
  let alpha: Buffer | null = null
  const idat: Buffer[] = []

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const body = buffer.subarray(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      depth = body[8]!
      colour = body[9]!
      if (body[12] !== 0) return null
    }
    else if (type === 'PLTE') palette = Buffer.from(body)
    else if (type === 'tRNS') alpha = Buffer.from(body)
    else if (type === 'IDAT') idat.push(Buffer.from(body))
    else if (type === 'IEND') break

    offset += 12 + length
  }

  if (!width || !height || depth !== 8) return null

  const channels = colour === 6 ? 4 : colour === 2 ? 3 : colour === 3 ? 1 : colour === 4 ? 2 : 0
  if (!channels) return null
  if (colour === 3 && !palette) return null

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = new Uint8ClampedArray(width * height * 4)
  const line = Buffer.alloc(stride)
  const previous = Buffer.alloc(stride)

  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]!
    raw.copy(line, 0, pos, pos + stride)
    pos += stride

    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? line[i - channels]! : 0
      const up = previous[i]!
      const upLeft = i >= channels ? previous[i - channels]! : 0

      if (filter === 1) line[i] = (line[i]! + left) & 0xFF
      else if (filter === 2) line[i] = (line[i]! + up) & 0xFF
      else if (filter === 3) line[i] = (line[i]! + ((left + up) >> 1)) & 0xFF
      else if (filter === 4) line[i] = (line[i]! + paeth(left, up, upLeft)) & 0xFF
    }

    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const i = x * channels

      if (colour === 3) {
        const index = line[i]!
        out[o] = palette![index * 3]!
        out[o + 1] = palette![index * 3 + 1]!
        out[o + 2] = palette![index * 3 + 2]!
        out[o + 3] = alpha && index < alpha.length ? alpha[index]! : 255
      }
      else if (colour === 4) {
        out[o] = out[o + 1] = out[o + 2] = line[i]!
        out[o + 3] = line[i + 1]!
      }
      else {
        out[o] = line[i]!
        out[o + 1] = line[i + 1]!
        out[o + 2] = line[i + 2]!
        out[o + 3] = channels === 4 ? line[i + 3]! : 255
      }
    }

    line.copy(previous)
  }

  return { data: out, width, height }
}

export function normaliseTexture(decoded: Decoded): Decoded {
  if (!isLegacySkin(decoded.width, decoded.height)) return decoded

  const data = new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4)

  for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
      const from = (y * decoded.width + x) * 4
      const to = (y * SKIN_SIZE + x) * 4
      for (let c = 0; c < 4; c++) data[to + c] = decoded.data[from + c]!
    }
  }

  for (const copy of LEGACY_COPIES) {
    for (let y = 0; y < copy.from.h; y++) {
      for (let x = 0; x < copy.from.w; x++) {
        const from = ((copy.from.y + y) * SKIN_SIZE + (copy.from.x + x)) * 4
        const to = ((copy.to[1] + y) * SKIN_SIZE + (copy.to[0] + copy.from.w - 1 - x)) * 4
        for (let c = 0; c < 4; c++) data[to + c] = data[from + c]!
      }
    }
  }

  stripLegacyHat(data, SKIN_SIZE)

  return { data, width: SKIN_SIZE, height: SKIN_SIZE }
}
