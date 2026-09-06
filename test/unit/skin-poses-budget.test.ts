import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const page = readFileSync('app/pages/tools/skin-poses.vue', 'utf8')
const route = readFileSync('server/routes/render/[type]/[player]/[crop].get.ts', 'utf8')

function poseCount(): number {
  const source = readFileSync('app/utils/skinPose.ts', 'utf8')
  const block = /export const POSES[^=]*=\s*\[([\s\S]*?)\n\]/.exec(source)
  return block ? (block[1]!.match(/\bid:/g) ?? []).length : 0
}

// Every thumbnail in the pose gallery is its own request. When the thumbnails
// carried the lighting and effect settings, one click on a toggle re-requested
// all of them, and a handful of clicks exhausted the budget — at which point the
// characters stopped appearing with no visible reason.
describe('the pose gallery does not re-render on every toggle', () => {
  it('thumbnails ignore lighting, effect and the other controls', () => {
    const start = page.indexOf('const poseThumbUrl')
    const thumb = page.slice(start, page.indexOf('const renderUrl', start))

    expect(thumb).toBeTruthy()
    for (const setting of ['lightId', 'effectId', 'rim', 'showCape', 'showVoxel', 'showTag']) {
      expect(thumb, setting).not.toContain(setting)
    }
  })

  it('the gallery uses the fixed thumbnail address, not the full one', () => {
    expect(page).toContain(':src="poseThumbUrl(p.id)"')
    expect(page).not.toContain(`renderUrl(p.id, 'full', 128)`)
  })

  // The main preview is the one image that should follow every control.
  it('the preview still reflects the settings', () => {
    expect(page).toContain('renderUrl(pose.value, crop.value, size.value)')
  })
})

describe('the render budget fits the page that uses it', () => {
  const limit = Number(/limit: (\d+), windowMs: 60_000/.exec(route)?.[1] ?? 0)

  it('one visit cannot use up a meaningful share of a minute', () => {
    const perVisit = poseCount() + 1
    expect(perVisit).toBeGreaterThan(1)

    // Room for a person to keep clicking, and for several people behind one
    // address to do the same.
    expect(limit / perVisit).toBeGreaterThanOrEqual(20)
  })

  it('it is still a limit', () => {
    expect(limit).toBeGreaterThan(0)
    expect(limit).toBeLessThanOrEqual(5_000)
  })
})
