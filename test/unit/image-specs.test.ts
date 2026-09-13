import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { IMAGE_SPECS, specDimensions } from '../../shared/utils/image-specs'
import { MOVING_IMAGE_TYPES, STILL_IMAGE_TYPES, acceptedLabel } from '../../shared/utils/image-uploads'

const read = (file: string) => readFileSync(file, 'utf8')

// A hint that disagrees with the server is worse than no hint: somebody sizes a
// banner to what the form promised and it comes back cropped. Each entry is
// checked against the endpoint it describes.
const ENDPOINTS: Record<keyof typeof IMAGE_SPECS, string> = {
  avatar: 'server/api/me/avatar.post.ts',
  banner: 'server/api/me/banner.post.ts',
  projectIcon: 'server/api/catalog/project/[slug]/icon.post.ts',
  projectGallery: 'server/api/catalog/project/[slug]/gallery.post.ts',
  orgLogo: 'server/api/org/[slug]/logo.post.ts',
  badge: 'server/api/admin/badges/image.post.ts',
  postImage: 'server/api/admin/posts/[id]/image.post.ts',
}

describe('podpowiedzi zgadzaja sie z serwerem', () => {
  it.each(Object.keys(IMAGE_SPECS) as Array<keyof typeof IMAGE_SPECS>)('%s', (id) => {
    const spec = IMAGE_SPECS[id]
    const source = read(ENDPOINTS[id])

    const sizes = [...source.matchAll(/(?:size|SIZE|WIDTH)\s*[:=]\s*(\d+)/g)].map(m => Number(m[1]))
    expect(sizes, `${id}: brak rozmiaru w ${ENDPOINTS[id]}`).toContain(spec.size)

    // both shapes appear: N * 1024 * 1024 and, for the small ones, N * 1024
    const mb = /MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(source)
    const kb = /MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024\b(?!\s*\*)/.exec(source)

    const declared = mb ? Number(mb[1]) : Number(kb?.[1]) / 1024
    expect(declared, `${id}: limit rozmiaru`).toBe(spec.maxMb)

    // GIF is offered exactly where the spec says an animation survives
    const takesGif = /MOVING_IMAGE_TYPES/.test(source)
    expect(takesGif, `${id}: typy`).toBe(spec.animated)
  })

  it('kwadrat mowi dwa wymiary, reszta jeden', () => {
    expect(specDimensions(IMAGE_SPECS.avatar)).toBe('512 × 512')
    expect(specDimensions(IMAGE_SPECS.banner)).toBe('1600')
  })

  it('animacja idzie w parze z przyjmowaniem gifow', () => {
    for (const [id, spec] of Object.entries(IMAGE_SPECS)) {
      const expected = spec.animated ? MOVING_IMAGE_TYPES : STILL_IMAGE_TYPES
      expect(spec.types, id).toEqual(expected)
    }
  })

  it('lista typow czyta sie po ludzku', () => {
    expect(acceptedLabel(STILL_IMAGE_TYPES)).toBe('webp, png, jpeg')
    expect(acceptedLabel(MOVING_IMAGE_TYPES)).toBe('webp, png, jpeg, gif')
  })
})

// Every place a picture can be chosen says what it will become. A form that
// stays silent is how somebody uploads a 3000px logo and finds it cropped.
describe('kazdy upload mowi, czego oczekuje', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))

  // Not every file input is a picture: a skin editor and a rank tool read the
  // file in the browser and never upload it.
  const NOT_UPLOADS = [
    'app/pages/tools/skin-editor.vue',
    'app/pages/tools/rank.vue',
    'app/pages/[type]/[slug]/settings/versions.vue',
    'app/components/ui/MarkdownEditor.vue',
    'app/pages/admin/catalog.vue',
  ]

  it('przy kazdym wyborze zdjecia jest podpowiedz', () => {
    const silent = walk('app')
      .filter(file => file.endsWith('.vue'))
      .map(file => file.split(sep).join('/'))
      .filter(file => !NOT_UPLOADS.includes(file))
      .filter(file => /type="file"/.test(readFileSync(file, 'utf8')))
      .filter(file => !/<UiUploadHint/.test(readFileSync(file, 'utf8')))

    expect(silent).toEqual([])
  })
})
