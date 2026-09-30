import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { launcherRequirement } from '../../shared/utils/addon-install'
import { MIGRATIONS } from '../../server/utils/migrations'

const read = (file: string) => readFileSync(file, 'utf8')

describe('wersja launchera zamiast wersji Minecrafta', () => {
  it('bierze sie z addon.json zapisanego w wersji', () => {
    expect(launcherRequirement({ addonId: 'a', launcher: '>=0.10.0' })).toEqual({ range: '>=0.10.0' })
    expect(launcherRequirement({ addonId: 'a', launcher: null })).toEqual({ range: null })
    expect(launcherRequirement({ addonId: 'a', launcher: '  ' })).toEqual({ range: null })
  })

  it('nie dotyczy wersji innych typow', () => {
    expect(launcherRequirement({ launcher: '>=1' })).toBeNull()
    expect(launcherRequirement(null)).toBeNull()
    expect(launcherRequirement(undefined)).toBeNull()
  })
})

describe('addon nie pyta o pola Minecrafta', () => {
  it('formularze wersji chowaja loadery i wersje gry, a numer jest z pliku', () => {
    for (const file of [
      'app/pages/[type]/[slug]/settings/versions.vue',
      'app/pages/[type]/[slug]/settings/version/[version].vue',
    ]) {
      const source = read(file)
      expect(source, file).toContain('v-if="!forLauncher" class="sm:col-span-2"')
      expect(source, file).toContain(':disabled="forLauncher"')
      expect(source, file).toContain('<ProjectLauncherRange')
    }
  })

  it('tagi, panel admina i kreator nie pytaja o srodowisko', () => {
    expect(read('app/pages/[type]/[slug]/settings/tags.vue')).toContain('v-if="!isLauncherType(project?.type)"')
    expect(read('app/pages/admin/catalog.vue')).toContain('v-if="!isLauncherType(selected.type)"')
    expect(read('app/pages/create/project.vue')).not.toContain('ENVIRONMENTS')
  })

  it('serwer nie zapisuje addonowi srodowiska', () => {
    expect(read('server/utils/catalog.ts')).toMatch(/isLauncherType\(current\.type\)\s*\? \[\]/)
  })

  it('istniejace addony traca loader spectra i srodowisko client', () => {
    const step = MIGRATIONS.find(m => m.id === '005-addons-have-no-minecraft-fields')
    expect(step?.up).toContain("UPDATE project SET loaders = '{}', game_versions = '{}', environment = '{}'")
    expect(step?.down).toContain("loaders = '{spectra}'")
  })
})
