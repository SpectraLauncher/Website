import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(file, 'utf8')

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
