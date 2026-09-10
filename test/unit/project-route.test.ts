import { describe, expect, it } from 'vitest'

import { projectRouteParts } from '../../app/utils/projectRoute'

describe('adres strony projektu', () => {
  it('bez segmentu to opis', () => {
    for (const value of [undefined, null, '', []]) {
      expect(projectRouteParts(value), String(value)).toEqual({ tab: '', versionId: '' })
    }
  })

  it('jeden segment to zakladka', () => {
    expect(projectRouteParts('versions')).toEqual({ tab: 'versions', versionId: '' })
    expect(projectRouteParts(['gallery'])).toEqual({ tab: 'gallery', versionId: '' })
  })

  it('version/<id> to ta zakladka z wybrana wersja', () => {
    expect(projectRouteParts('version/abc123')).toEqual({ tab: 'versions', versionId: 'abc123' })
    expect(projectRouteParts(['version', 'abc123'])).toEqual({ tab: 'versions', versionId: 'abc123' })
  })

  it('samo version, bez id, otwiera liste', () => {
    expect(projectRouteParts('version')).toEqual({ tab: 'versions', versionId: '' })
  })

  it('nadmiarowe segmenty i ukosniki nie psuja odczytu', () => {
    expect(projectRouteParts('/version//abc123/')).toEqual({ tab: 'versions', versionId: 'abc123' })
    expect(projectRouteParts(['version', 'abc123', 'files'])).toEqual({ tab: 'versions', versionId: 'abc123' })
  })
})
