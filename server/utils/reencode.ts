import sharp from 'sharp'

export interface ReencodeOptions {
  size: number
  fit: 'cover' | 'contain'
}

export async function reencodeWebp(input: Buffer | Uint8Array, options: ReencodeOptions) {
  const image = sharp(input, { failOn: 'none', animated: false })
  const meta = await image.metadata()

  if (!meta.width || !meta.height) {
    throw createError({ statusCode: 400, statusMessage: 'to nie jest obrazek' })
  }

  return image
    .resize({
      width: options.size,
      height: options.size,
      fit: options.fit,
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer()
}
