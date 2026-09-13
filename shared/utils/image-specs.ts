import { MOVING_IMAGE_TYPES, STILL_IMAGE_TYPES } from './image-uploads'

/**
 * What each upload is actually turned into.
 *
 * One registry rather than a sentence typed next to every file input, because a
 * hint that disagrees with the server is worse than no hint: somebody sizes a
 * banner to what the form promised and it comes back cropped.
 *
 * The numbers here are the ones the endpoints pass to reencodeWebp. Changing a
 * size means changing it in both places — the test in test/unit/image-specs
 * checks they still agree.
 *
 * To add a surface: one entry here, one `images.specs.<id>` string per locale,
 * and <UiUploadHint id="..."> next to the input.
 */
/** The tallest a banner is ever drawn; see app/components/ui/Backdrop. */
export const BANNER_HEIGHT = 560

export interface ImageSpec {
  /** The longest side the stored copy is bounded to. */
  size: number
  /** 'cover' crops to a square; 'inside' keeps the shape. */
  fit: 'cover' | 'inside'
  /** The height it is drawn at, when the surface has one. Banners do. */
  height?: number
  /** Megabytes the request body may be. */
  maxMb: number
  /** Whether an animation survives. */
  animated: boolean
  types: readonly string[]
}

export const IMAGE_SPECS = {
  avatar: { size: 512, fit: 'cover', maxMb: 2, animated: false, types: STILL_IMAGE_TYPES },
  banner: { size: 1920, fit: 'inside', height: BANNER_HEIGHT, maxMb: 6, animated: true, types: MOVING_IMAGE_TYPES },
  projectBanner: { size: 1920, fit: 'inside', height: BANNER_HEIGHT, maxMb: 6, animated: true, types: MOVING_IMAGE_TYPES },
  projectIcon: { size: 256, fit: 'cover', maxMb: 4, animated: true, types: MOVING_IMAGE_TYPES },
  projectGallery: { size: 1280, fit: 'inside', maxMb: 8, animated: true, types: MOVING_IMAGE_TYPES },
  orgLogo: { size: 256, fit: 'cover', maxMb: 2, animated: false, types: STILL_IMAGE_TYPES },
  badge: { size: 256, fit: 'inside', maxMb: 0.5, animated: false, types: STILL_IMAGE_TYPES },
  postImage: { size: 1600, fit: 'inside', maxMb: 8, animated: true, types: MOVING_IMAGE_TYPES },
} as const satisfies Record<string, ImageSpec>

export type ImageSpecId = keyof typeof IMAGE_SPECS

/** Half a megabyte reads better as 512 KB than as 0.5 MB. */
export function specWeight(spec: ImageSpec): string {
  return spec.maxMb < 1 ? `${Math.round(spec.maxMb * 1024)} KB` : `${spec.maxMb} MB`
}

/**
 * "1920 × 560" where the surface has a shape, "512 × 512" for a square, and the
 * bound on the longest side where the shape is the author's own.
 */
export function specDimensions(spec: ImageSpec): string {
  if (spec.height) return `${spec.size} × ${spec.height}`
  return spec.fit === 'cover' ? `${spec.size} × ${spec.size}` : String(spec.size)
}
