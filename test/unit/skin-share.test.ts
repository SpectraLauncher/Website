import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { encodePng } from '../../server/utils/png'
import {
  SKIN_SHARE_MAX_ENTRIES,
  SKIN_SHARE_TTL,
  isSkinPng,
  isSkinShareId,
  shareSkin,
  sharedSkinPng,
} from '../../server/utils/skin-share'

const png = (width: number, height: number) => encodePng(new Uint8ClampedArray(width * height * 4), width, height)

describe('skin przekazany do edytora', () => {
  it('przyjmuje tylko PNG skina w rozmiarze 64x64 albo 64x32', () => {
    expect(isSkinPng(png(64, 64))).toBe(true)
    expect(isSkinPng(png(64, 32))).toBe(true)
    expect(isSkinPng(png(128, 128))).toBe(false)
    expect(isSkinPng(png(32, 32))).toBe(false)
    expect(isSkinPng(Buffer.from('not a png at all, just some text'))).toBe(false)
    expect(isSkinPng(Buffer.alloc(0))).toBe(false)
  })

  it('oddaje skin pod krotkim id i tylko przez pietnascie minut', () => {
    const skin = png(64, 64)
    const id = shareSkin(skin, 1_000)
    expect(isSkinShareId(id)).toBe(true)
    expect(sharedSkinPng(id, 1_000 + SKIN_SHARE_TTL - 1)?.equals(skin)).toBe(true)
    expect(sharedSkinPng(id, 1_000 + SKIN_SHARE_TTL)).toBeNull()
  })

  it('nie trzyma w pamieci wiecej niz limit', () => {
    const first = shareSkin(png(64, 64), 5_000)
    for (let i = 0; i < SKIN_SHARE_MAX_ENTRIES; i++) shareSkin(png(64, 64), 5_000)
    expect(sharedSkinPng(first, 5_000)).toBeNull()
  })

  it('odrzuca id, ktore nie wyglada na nasze', () => {
    for (const bad of ['', 'short', '../../etc/passwd', 'a'.repeat(17), null, 12]) {
      expect(isSkinShareId(bad), String(bad)).toBe(false)
    }
  })

  it('edytor bierze skin z ?share i ma limit zapytan po stronie serwera', () => {
    expect(readFileSync('app/pages/tools/skin-editor.vue', 'utf8')).toContain('/api/tools/skin-share/${share}')
    const post = readFileSync('server/api/tools/skin-share.post.ts', 'utf8')
    expect(post.indexOf('rateLimit(')).toBeLessThan(post.indexOf('shareSkin('))
    expect(post).toContain('isSkinPng(png)')
  })

  it('prerenderowane narzedzia czytaja parametry z adresu, bo route.query jest pusty w trakcie hydracji', () => {
    const readers = readdirSync('app/pages/tools')
      .filter(name => name.endsWith('.vue') && readFileSync(`app/pages/tools/${name}`, 'utf8').includes('useRoute()'))

    expect(readers).toEqual([])
    expect(readFileSync('app/pages/tools/skin-editor.vue', 'utf8')).toContain('new URLSearchParams(window.location.search)')
  })
})
