import sharp from 'sharp'

export interface ReencodeOptions {
  size: number
  fit: 'cover' | 'contain' | 'inside'
}

export async function reencodeWebp(input: Buffer | Uint8Array, options: ReencodeOptions) {
  const image = sharp(input, { failOn: 'none', animated: false })
  const meta = await image.metadata()

  if (!meta.width || !meta.height) {
    throw createError({ statusCode: 400, statusMessage: 'to nie jest obrazek' })
  }

  // 'cover' and 'contain' both take a square box, which is right for an avatar
  // and wrong for everything else: a 16:9 screenshot came back padded to a
  // square with transparent bars down the sides. 'inside' bounds the longest
  // side and leaves the shape alone.
  const box = options.fit === 'inside'
    ? { width: options.size, height: options.size, fit: 'inside' as const }
    : { width: options.size, height: options.size, fit: options.fit }

  return image
    .resize({
      ...box,
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer()
}
