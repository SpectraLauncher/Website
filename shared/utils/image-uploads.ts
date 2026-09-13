/**
 * What an upload may be.
 *
 * Two lists rather than one per endpoint, because "is a GIF allowed here" is a
 * decision about the surface, not about the file: a moving picture belongs on a
 * project's icon and in its gallery, and does not belong on a report
 * attachment. Everything is re-encoded on the way in either way — see
 * server/utils/reencode — so the list is about intent, not about safety.
 */
export const STILL_IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg'] as const

/** The same, plus GIF: surfaces where an animation is the point. */
export const MOVING_IMAGE_TYPES = [...STILL_IMAGE_TYPES, 'image/gif'] as const

export function acceptAttribute(types: readonly string[]): string {
  return types.join(',')
}

/** The sentence an upload is refused with, built from what it would have taken. */
export function acceptedLabel(types: readonly string[]): string {
  return types.map(type => type.replace('image/', '')).join(', ')
}
