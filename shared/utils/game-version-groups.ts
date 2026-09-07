export interface PickableVersion {
  id: string
  type: string
  released: number
}

export interface VersionGroup {
  key: string
  versions: string[]
  release: boolean
}

const SNAPSHOTS = 'Snapshots'

// Minecraft's manifest is one flat list in release order, and a picker built
// straight off it is four hundred buttons. Grouping is what makes it usable:
// releases collapse to their major line, and a snapshot joins the line it leads
// to rather than starting one of its own.
//
// A snapshot only names its own line when it starts with something like `1.21-`
// or `25w`; anything else — `3D-Shareware-v1.34` and friends — belongs to
// whatever line was last seen, which is why the manifest order matters.
const NAMES_ITS_LINE = /^\d(\d\.|\.\d)/

function line(id: string): string {
  return id.split('-')[0]!.split('.').slice(0, 2).join('.')
}

export function groupVersions(versions: PickableVersion[]): VersionGroup[] {
  const newest = [...versions].sort((a, b) => b.released - a.released)

  const groups = new Map<string, { versions: string[], release: boolean }>()
  let current = ''

  for (const version of newest) {
    const isRelease = version.type === 'release'

    if (isRelease || !current || NAMES_ITS_LINE.test(version.id)) {
      current = line(version.id)
    }

    const key = isRelease ? current : `${current} ${SNAPSHOTS}`
    const group = groups.get(key) ?? { versions: [], release: isRelease }
    group.versions.push(version.id)
    groups.set(key, group)
  }

  return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
}

export function isReleaseGroup(key: string): boolean {
  return !key.endsWith(SNAPSHOTS)
}
