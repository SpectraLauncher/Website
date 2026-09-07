import { describe, expect, it } from 'vitest'

import { groupVersions, isReleaseGroup } from '../../shared/utils/game-version-groups'

// Newest first, the way the manifest arrives.
const manifest = [
  { id: '25w14a', type: 'snapshot', released: 100 },
  { id: '1.21.4', type: 'release', released: 90 },
  { id: '1.21.4-rc1', type: 'snapshot', released: 85 },
  { id: '1.21', type: 'release', released: 80 },
  { id: '3D-Shareware-v1.34', type: 'snapshot', released: 70 },
  { id: '1.20.1', type: 'release', released: 60 },
  { id: '1.20', type: 'release', released: 55 },
]

describe('grupowanie wersji gry', () => {
  const groups = groupVersions(manifest)
  const byKey = Object.fromEntries(groups.map(g => [g.key, g.versions]))

  it('sklada wydania w linie', () => {
    expect(byKey['1.21']).toEqual(['1.21.4', '1.21'])
    expect(byKey['1.20']).toEqual(['1.20.1', '1.20'])
  })

  it('snapshot wydania trafia do linii tego wydania', () => {
    expect(byKey['1.21 Snapshots']).toContain('1.21.4-rc1')
  })

  // The newest entries in the real manifest are snapshots for a release that
  // does not exist yet, so there is no line for them to join.
  it('migawka przed pierwszym wydaniem zaklada wlasna linie', () => {
    expect(byKey['25w14a Snapshots']).toEqual(['25w14a'])
  })

  // 3D-Shareware-v1.34 names nothing, so it belongs to whatever line the
  // manifest was in when it appeared.
  it('snapshot bez nazwy linii zostaje w poprzedniej', () => {
    const group = groups.find(g => g.versions.includes('3D-Shareware-v1.34'))
    expect(group?.key).toBe('1.21 Snapshots')
  })

  it('odroznia grupe wydan od migawek', () => {
    expect(isReleaseGroup('1.21')).toBe(true)
    expect(isReleaseGroup('1.21 Snapshots')).toBe(false)
  })

  it('nie gubi zadnej wersji', () => {
    const all = groups.flatMap(g => g.versions)
    expect(all.sort()).toEqual(manifest.map(v => v.id).sort())
  })

  it('radzi sobie z pusta lista', () => {
    expect(groupVersions([])).toEqual([])
  })
})
