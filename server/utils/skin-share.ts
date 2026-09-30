import { randomBytes } from 'node:crypto'

export const SKIN_SHARE_TTL = 15 * 60_000
export const SKIN_SHARE_MAX_BYTES = 64 * 1024
export const SKIN_SHARE_MAX_ENTRIES = 500

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const shares = new Map<string, { png: Buffer, expires: number }>()

export function isSkinPng(png: Buffer): boolean {
  if (png.length < 24 || png.length > SKIN_SHARE_MAX_BYTES) return false
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) return false
  if (png.toString('ascii', 12, 16) !== 'IHDR') return false
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  return width === 64 && (height === 64 || height === 32)
}

export function isSkinShareId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16}$/.test(value)
}

export function shareSkin(png: Buffer, now = Date.now()): string {
  for (const [id, entry] of shares) {
    if (entry.expires <= now) shares.delete(id)
  }
  while (shares.size >= SKIN_SHARE_MAX_ENTRIES) {
    shares.delete(shares.keys().next().value!)
  }
  const id = randomBytes(12).toString('base64url')
  shares.set(id, { png, expires: now + SKIN_SHARE_TTL })
  return id
}

export function sharedSkinPng(id: string, now = Date.now()): Buffer | null {
  const entry = shares.get(id)
  if (!entry) return null
  if (entry.expires <= now) {
    shares.delete(id)
    return null
  }
  return entry.png
}
