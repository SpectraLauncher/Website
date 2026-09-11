import { describe, expect, it } from 'vitest'

import { versionPicks } from '../../app/utils/versionPick'

const v = (id: string, gameVersions: string[], loaders: string[], channel = 'release') =>
  ({ id, gameVersions, loaders, channel })

describe('wybor wersji pod zestaw gracza', () => {
  it('pusta lista nie daje nic', () => {
    expect(versionPicks([])).toEqual([])
  })

  it('rozbija wersje na pary gra x platforma', () => {
    const picks = versionPicks([v('a', ['1.21.1', '1.21.4'], ['fabric', 'neoforge'])])

    expect(picks.map(p => `${p.gameVersion}/${p.loader}`)).toEqual([
      '1.21.1/fabric', '1.21.1/neoforge', '1.21.4/fabric', '1.21.4/neoforge',
    ])
  })

  it('pierwsza wersja wygrywa pare, bo lista idzie od najnowszej', () => {
    const picks = versionPicks([
      v('nowa', ['1.21.1'], ['fabric']),
      v('stara', ['1.21.1'], ['fabric']),
    ])

    expect(picks).toHaveLength(1)
    expect(picks[0]!.version.id).toBe('nowa')
  })

  it('beta wchodzi tylko tam, gdzie nie ma release', () => {
    const picks = versionPicks([
      v('beta', ['1.21.1', '1.22'], ['fabric'], 'beta'),
      v('release', ['1.21.1'], ['fabric']),
    ])

    expect(picks.find(p => p.gameVersion === '1.21.1')!.version.id).toBe('release')
    expect(picks.find(p => p.gameVersion === '1.22')!.version.id).toBe('beta')
  })

  it('wersja bez loadera nie tworzy pary', () => {
    expect(versionPicks([v('a', ['1.21.1'], [])])).toEqual([])
  })
})
