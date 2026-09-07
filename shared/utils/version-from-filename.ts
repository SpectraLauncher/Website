import type { VersionChannel } from './catalog-types'

// A manifest is the better source for a version number, but plenty of files
// have none: a resourcepack has no field for it, a shader pack has no manifest
// at all, and a jar built without the gradle substitution carries a literal
// `${version}`. The filename almost always still says it, because that is how
// build tools name their output.

// Extensions to strip before looking for a version. Add new upload formats here.
const EXTENSIONS = /\.(zip|jar|mrpack|nbt|litematic|schem|schematic)$/i

// Build tools stamp the game version into the name too. It is not the file's
// own version, and it looks exactly like one, so it goes before the search.
const GAME_VERSION_MARKER = /[+_-]mc\d+\.\d+(?:\.\d+)?/gi

const PATTERNS = [
  /[_\-\s]v(\d+(?:\.\d+)*)/i, // sodium-v0.5.8
  /[_\-\s]r(\d+(?:\.\d+)*)/i, // sodium-r0.5.8
  /[_\-\s](\d+(?:\.\d+)+)$/, //  Sodium 0.5.8
  /(\d+\.\d+(?:\.\d+)*)/, //     sodium0.5.8-fabric
]

export function versionFromFilename(filename: string | null | undefined): string | null {
  if (!filename) return null

  const name = filename.replace(EXTENSIONS, '').replace(GAME_VERSION_MARKER, '')

  for (const pattern of PATTERNS) {
    const found = pattern.exec(name)?.[1]
    if (found) return found
  }

  return null
}

// `rc` and `pre` only count as their own word: "precision-1.0" is a release.
export function channelFromVersion(version: string | null | undefined): VersionChannel {
  if (!version) return 'release'
  const lower = version.toLowerCase()

  if (lower.includes('alpha')) return 'alpha'
  if (lower.includes('beta') || /[^a-z](rc|pre)[^a-z]/.test(lower)) return 'beta'

  return 'release'
}
