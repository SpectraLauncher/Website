import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { cssSafeAssetUrl } from '../../shared/utils/links'

const read = (file: string) => readFileSync(file, 'utf8')

describe('pas nad karta', () => {
  // The project moved from a wash behind the whole page to a band inside the
  // header card; the profile copied the pattern that had been replaced.
  it('profil i projekt rysuja go jednym komponentem', () => {
    expect(read('app/components/project/Backdrop.vue')).toMatch(/<UiBackdrop/)
    expect(read('app/pages/u/[username].vue')).toMatch(/<UiBackdrop :image="data\.user\.banner"/)
  })

  it('powloka strony nie maluje juz tla', () => {
    const shell = read('app/components/ui/PageShell.vue')

    expect(shell).not.toMatch(/backdrop/)
    expect(shell).not.toMatch(/backgroundImage/)
  })

  it('adres idzie przez sanitizer, nie przez stringify', () => {
    const backdrop = read('app/components/ui/Backdrop.vue')

    expect(backdrop).toMatch(/cssSafeAssetUrl/)
    expect(backdrop).not.toMatch(/JSON\.stringify/)
  })

  // url(...) ends at the first bracket or quote, so anything carrying one is
  // refused rather than escaped.
  it('adres, ktorym dalo by sie wyjsc z url(), jest odrzucany', () => {
    for (const nasty of [
      'https://cdn.example/a.png") ; background: red; x: url("',
      "https://cdn.example/a'.png",
      'https://cdn.example/a(1).png',
    ]) {
      expect(cssSafeAssetUrl(nasty), nasty).toBeNull()
    }

    // A space is encoded rather than refused, which is also safe inside url().
    expect(cssSafeAssetUrl('https://cdn.example/a b.png')).toBe('https://cdn.example/a%20b.png')
    expect(cssSafeAssetUrl('https://cdn.example/ok.webp?v=1')).toBe('https://cdn.example/ok.webp?v=1')
  })
})

describe('sesja niesie pola profilu', () => {
  // Written by their own endpoints, but read from the session: without the
  // declaration the settings form comes back empty after a reload and the save
  // looks lost, which is exactly how the banner behaved.
  it('banner i bio sa zadeklarowane', () => {
    const auth = read('server/utils/auth.ts')

    for (const field of ['banner', 'bio']) {
      expect(auth, field).toContain(`${field}: { type: 'string', required: false, input: false }`)
    }
  })

  // The durable fix for the whole class: what lives in a column of ours is read
  // from a route of ours, so no field can quietly be missing from the session.
  it('bio, linki i baner ida z wlasnego endpointu, nie z sesji', () => {
    const settings = read('app/pages/dashboard/settings.vue')

    expect(settings).toContain("'/api/me/profile'")
    expect(settings).not.toContain('u.bio ??')
    expect(settings).not.toContain('u.links ??')
    expect(settings).not.toContain('banner?: string | null }).banner')
  })
})
