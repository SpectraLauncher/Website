import { describe, expect, it } from 'vitest'

import { channelFromVersion, versionFromFilename } from '../../shared/utils/version-from-filename'

describe('wersja z nazwy pliku', () => {
  it('czyta wersje z nazw jakie wypuszczaja buildy', () => {
    expect(versionFromFilename('sodium-fabric-0.6.13+mc1.21.5.jar')).toBe('0.6.13')
    expect(versionFromFilename('lithium-fabric-0.14.3.jar')).toBe('0.14.3')
    expect(versionFromFilename('Iris-1.8.8+mc1.21.4.jar')).toBe('1.8.8')
    expect(versionFromFilename('MyMod-v2.0.jar')).toBe('2.0')
    expect(versionFromFilename('Faithful 32x 1.21.zip')).toBe('1.21')
  })

  // The game version is stamped into the name by the build, and looks exactly
  // like the file's own version — it has to be removed before the search.
  it('nie bierze wersji gry za wersje pliku', () => {
    expect(versionFromFilename('create-1.0.1-mc1.20.1.jar')).toBe('1.0.1')
    expect(versionFromFilename('pack_mc1.21.4.mrpack')).toBe(null)
    // Nothing marks 1.20.1 here as the game version, so the one at the end
    // wins — which is the mod's own, and is what the name is built to say.
    expect(versionFromFilename('jei-1.20.1-forge-15.3.0.4.jar')).toBe('15.3.0.4')
  })

  it('radzi sobie z formatami spoza jarow', () => {
    expect(versionFromFilename('CoolBase-1.4.litematic')).toBe('1.4')
    expect(versionFromFilename('adventure-2.1.0.mrpack')).toBe('2.1.0')
  })

  it('nie zmysla wersji, ktorej nie ma', () => {
    expect(versionFromFilename('mymod.jar')).toBe(null)
    expect(versionFromFilename('')).toBe(null)
    expect(versionFromFilename(null)).toBe(null)
  })
})

describe('kanal z numeru wersji', () => {
  it('rozpoznaje kanaly przedpremierowe', () => {
    expect(channelFromVersion('1.0.0-alpha.2')).toBe('alpha')
    expect(channelFromVersion('1.0.0-beta')).toBe('beta')
    expect(channelFromVersion('1.0.0-rc1')).toBe('beta')
    expect(channelFromVersion('1.0.0-pre3')).toBe('beta')
  })

  it('zwykla wersja to wydanie', () => {
    expect(channelFromVersion('1.0.0')).toBe('release')
    expect(channelFromVersion(null)).toBe('release')
  })

  // `rc` and `pre` inside a word are just letters.
  it('nie myli slowa zawierajacego rc albo pre z kanalem', () => {
    expect(channelFromVersion('precision-1.0')).toBe('release')
    expect(channelFromVersion('1.0-arcade')).toBe('release')
  })
})
