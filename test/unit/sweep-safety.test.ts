import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { IMAGE_CONTEXTS, isImageContext } from '../../server/utils/images'

// The catalog was never deployed, so the only real production data is accounts
// and modpacks shared from the launcher. The orphan sweep deletes files from R2,
// so a mistake here deletes packs people shared.
describe('sprzatanie nie moze dotknac paczek z launchera', () => {
  const images = readFileSync('server/utils/images.ts', 'utf8')

  it('bierze klucze wylacznie z tabeli obrazow', () => {
    expect(images).toContain('FROM stored_image')
    // It never lists the bucket; doing so would see the packs as well.
    expect(images).not.toContain('r2List')
    expect(images).not.toContain('listObjects')
  })

  it('kasuje tylko to, co samo wczesniej zapisalo', () => {
    expect(images).toContain('orphanedImages(limit)')
    expect(images).toContain('r2Delete(r2, row.object_key)')
  })

  // shares.object_key never goes through recordImage, so it cannot appear in
  // stored_image.
  it('nie ma kontekstu dla udostepnionej paczki', () => {
    expect(IMAGE_CONTEXTS).not.toContain('share' as never)
    expect(isImageContext('share')).toBe(false)
    expect(images).not.toContain('shares')
  })

  it('zapis do tabeli obrazow ma tylko cztery miejsca i zadne nie dotyczy paczek', () => {
    const callers = [
      'server/api/me/avatar.post.ts',
      'server/api/org/[slug]/logo.post.ts',
      'server/utils/catalog-images.ts',
    ]

    for (const file of callers) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).toContain('recordImage')
      expect(source, file).not.toContain('shares')
    }
  })

  // Somebody has to ask for it from the panel. A delete loop on a timer is what
  // turns a wrong query into data loss.
  it('nie chodzi z zegara', () => {
    const plugin = readFileSync('server/plugins/jobs.ts', 'utf8')
    expect(plugin).not.toContain('queueSweep')
    expect(plugin).not.toContain('sweepOrphans')
  })
})

// The sweep used to look only at whether the project still existed, so a gallery
// image deleted on its own stayed in the bucket for good — the project was still
// there, so nothing ever called it an orphan.
describe('sprzatanie widzi tez obrazy bez wiersza', () => {
  const images = readFileSync('server/utils/images.ts', 'utf8')

  it('sprawdza galerie, opis i ikone, nie tylko istnienie projektu', () => {
    expect(images).toContain('FROM project_gallery g')
    expect(images).toContain('p.description LIKE')
    expect(images).toContain("COALESCE(p.icon, '') LIKE")
  })

  // An image is uploaded before the description that mentions it is saved.
  it('daje obrazowi czas, zanim uzna go za nieuzywany', () => {
    expect(images).toContain('UNREFERENCED_GRACE_MS')
    expect(images).toContain('i.created < $2')
  })

  it('kasowanie z galerii samo usuwa obiekt, bez czekania na sprzatanie', () => {
    const catalog = readFileSync('server/utils/catalog.ts', 'utf8')
    const start = catalog.indexOf('export async function removeGalleryImage')
    expect(start).toBeGreaterThan(-1)
    expect(catalog.slice(start, start + 600)).toContain('dropStoredImage(')
  })
})
