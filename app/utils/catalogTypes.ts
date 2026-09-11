/**
 * What a listing and a project page need to know about a project type beyond
 * what the database holds: the mark it draws and the translation key its name
 * comes from. The address it lives at is TYPE_PREFIX, which the server shares.
 *
 * This exists because six page files used to carry the same four facts each,
 * differing only in their values — twelve files that were one registry wearing
 * a disguise.
 *
 * To add a type: an entry here, one in PROJECT_TYPES and TYPE_PREFIX
 * (shared/utils/catalog-types.ts), and the catalog.<key>.title / .sub strings
 * in every locale.
 */
export interface CatalogTypeInfo {
  type: ProjectType
  /** The first URL segment, e.g. `pack` for a modpack. */
  prefix: string
  icon: string
  /** Prefix of the catalog.<key>.title and .sub translations. */
  key: string
}

export const CATALOG_TYPES: CatalogTypeInfo[] = [
  { type: 'mod', prefix: 'mod', icon: 'i-pixelarticons-shapes', key: 'mods' },
  { type: 'plugin', prefix: 'plugin', icon: 'i-pixelarticons-plug', key: 'plugins' },
  { type: 'resourcepack', prefix: 'resourcepack', icon: 'i-pixelarticons-image', key: 'resourcepacks' },
  { type: 'shader', prefix: 'shader', icon: 'i-pixelarticons-sun', key: 'shaders' },
  { type: 'modpack', prefix: 'pack', icon: 'i-pixelarticons-archive', key: 'modpacks' },
  { type: 'schematic', prefix: 'schematic', icon: 'i-pixelarticons-blocks', key: 'schematics' },
]

/**
 * The type a URL segment names, or null.
 *
 * Returning null rather than a default is what keeps `/anything/else` a 404:
 * the catalog pages match any first segment, so an unknown one has to be
 * refused rather than guessed at.
 */
export function catalogTypeByPrefix(prefix: unknown): CatalogTypeInfo | null {
  // Strings only: a route parameter arrives as an array when the segment repeats,
  // and String(['mod']) is 'mod' — which would let /mod/x/y in through a door
  // meant for /mod.
  if (typeof prefix !== 'string') return null

  return CATALOG_TYPES.find(entry => entry.prefix === prefix) ?? null
}
