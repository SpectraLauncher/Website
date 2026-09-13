import sharp from 'sharp'

export interface ReencodeOptions {
  size: number
  fit: 'cover' | 'contain' | 'inside'
  /**
   * Keep the animation when the source has one.
   *
   * Off everywhere it would be pointless or costly — an avatar, a report
   * attachment — and on where a moving picture is the point.
   */
  animated?: boolean
}

/**
 * What an animation is allowed to cost.
 *
 * A GIF is a container for arbitrarily many frames, and the file that holds
 * them can be tiny: a few hundred kilobytes can decode to gigabytes once every
 * frame is expanded. The byte cap upstream does not see that, so the frames are
 * counted here, before anything is decoded in full.
 */
const MAX_FRAMES = 120
const MAX_TOTAL_PIXELS = 60_000_000

/** One still frame's ceiling, so a single enormous canvas is refused too. */
const MAX_INPUT_PIXELS = 50_000_000

/**
 * Re-encode to WebP.
 *
 * Nothing a visitor uploads is ever served back byte for byte: whatever comes
 * in is decoded and written out again, so a file crafted against somebody's GIF
 * or PNG decoder never reaches another person's browser.
 */
export async function reencodeWebp(input: Buffer | Uint8Array, options: ReencodeOptions) {
  // Probed without animation first: this reads the header, so width and height
  // are one frame's and `pages` is the count, before any of it is expanded.
  const meta = await sharp(input, { failOn: 'none', limitInputPixels: MAX_INPUT_PIXELS })
    .metadata()

  if (!meta.width || !meta.height) {
    throw createError({ statusCode: 400, statusMessage: 'to nie jest obrazek' })
  }

  const frames = meta.pages ?? 1
  const moving = Boolean(options.animated) && frames > 1

  if (moving) {
    if (frames > MAX_FRAMES) {
      throw createError({ statusCode: 413, statusMessage: `animation is longer than ${MAX_FRAMES} frames` })
    }
    if (frames * meta.width * meta.height > MAX_TOTAL_PIXELS) {
      throw createError({ statusCode: 413, statusMessage: 'animation is too large to process' })
    }
  }

  const image = sharp(input, {
    failOn: 'none',
    animated: moving,
    limitInputPixels: MAX_INPUT_PIXELS,
  })

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
