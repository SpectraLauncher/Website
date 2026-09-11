import { describe, expect, it } from 'vitest'

import { canonicalProjectPath, projectRouteParts } from '../../app/utils/projectRoute'

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

describe('kanoniczny adres projektu', () => {
  const parts = (tab = '', versionId = '') => ({ tab, versionId })

  it('zgodny prefiks nie przekierowuje', () => {
    expect(canonicalProjectPath('mod', '/mod/terralith', parts())).toBeNull()
    expect(canonicalProjectPath('mod', '/mod/terralith', parts('versions'))).toBeNull()
  })

  it('niezgodny prefiks wskazuje adres projektu', () => {
    expect(canonicalProjectPath('mod', '/shader/sunrise', parts())).toBe('/shader/sunrise')
  })

  it('zabiera ze soba otwarta zakladke', () => {
    expect(canonicalProjectPath('mod', '/shader/sunrise', parts('gallery')))
      .toBe('/shader/sunrise/gallery')
  })

  it('zabiera ze soba otwarta wersje, nie zakladke', () => {
    expect(canonicalProjectPath('mod', '/shader/sunrise', parts('versions', 'abc123')))
      .toBe('/shader/sunrise/version/abc123')
  })

  // A slug that merely starts the same is a different project, not this one.
  it('nie myli prefiksu z poczatkiem sluga', () => {
    expect(canonicalProjectPath('mod', '/modpack/kitchen-sink', parts()))
      .toBe('/modpack/kitchen-sink')
  })

  it('brak adresu to brak przekierowania', () => {
    expect(canonicalProjectPath('mod', '', parts())).toBeNull()
  })
})
