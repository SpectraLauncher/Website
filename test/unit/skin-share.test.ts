import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SHARED_SKIN_MAX, sharedSkin } from '../../app/utils/mc/skin'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('skin przekazany z launchera w adresie', () => {
  it('czyta obraz i model z fragmentu', () => {
    const hash = `#${new URLSearchParams({ skin: png, model: 'slim' })}`
    expect(sharedSkin(hash)).toEqual({ png, model: 'slim' })
  })

  it('bez modelu albo z nieznanym przyjmuje classic', () => {
    expect(sharedSkin(`#skin=${encodeURIComponent(png)}`)?.model).toBe('classic')
    expect(sharedSkin(`#skin=${encodeURIComponent(png)}&model=giant`)?.model).toBe('classic')
  })

  it('odrzuca wszystko, co nie jest samym base64', () => {
    for (const bad of ['', '#', '#skin=', '#skin=<script>', '#skin=data:image/png;base64,AAAA', '#skin=AA%20AA']) {
      expect(sharedSkin(bad), bad).toBeNull()
    }
  })

  it('odrzuca za duzy obraz', () => {
    expect(sharedSkin(`#skin=${'A'.repeat(SHARED_SKIN_MAX + 4)}`)).toBeNull()
  })

  it('edytor czyta skin z fragmentu i usuwa go z adresu', () => {
    const page = readFileSync('app/pages/tools/skin-editor.vue', 'utf8')
    expect(page).toContain('sharedSkin(window.location.hash)')
    expect(page).toContain('window.history.replaceState(')
  })
})
