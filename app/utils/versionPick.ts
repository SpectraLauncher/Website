/**
 * The newest version for each combination of game version and platform a
 * project supports.
 *
 * This is what the download button needs: somebody on 1.21.1 with NeoForge
 * should not have to read a table to find out which file is theirs. Versions
 * arrive newest first, so the first one to claim a pair is the one to offer.
 *
 * Derived rather than author-curated on purpose. A "featured" flag would be
 * another column, another editor control and another thing to keep current, and
 * it answers a worse question: the newest build for somebody's own setup is
 * what they actually want, and it cannot go stale.
 */
export interface VersionPick<V> {
  gameVersion: string
  loader: string
  version: V
}

interface PickableRelease {
  gameVersions: string[]
  loaders: string[]
  channel: string
}

export function versionPicks<V extends PickableRelease>(
  versions: V[],
  opts: { channel?: string } = {},
): Array<VersionPick<V>> {
  const wanted = opts.channel ?? 'release'

  // A beta is offered only where no release covers that pair: it is an answer,
  // never the first one.
  const ordered = [
    ...versions.filter(version => version.channel === wanted),
    ...versions.filter(version => version.channel !== wanted),
  ]

  const seen = new Set<string>()
  const out: Array<VersionPick<V>> = []

  for (const version of ordered) {
    for (const gameVersion of version.gameVersions) {
      for (const loader of version.loaders) {
        const key = `${gameVersion} ${loader}`
        if (seen.has(key)) continue

        seen.add(key)
        out.push({ gameVersion, loader, version })
      }
    }
  }

  return out
}
