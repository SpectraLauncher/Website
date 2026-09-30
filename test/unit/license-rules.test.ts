import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { isSourceUrl, licenseProblem, needsSource } from '../../shared/utils/catalog-types'
import { checklistState } from '../../shared/utils/project-checklist'

const github = { source: 'https://github.com/someone/addon' }

describe('licencja projektu', () => {
  it('jest wymagana', () => {
    expect(licenseProblem({})).toBe('license-required')
    expect(licenseProblem({ license: 'WTFPL' })).toBe('license-required')
  })

  it.each(['MIT', 'Apache-2.0', 'GPL-3.0-only', 'MPL-2.0', 'CC-BY-4.0', 'Unlicense'])(
    '%s wymaga linku do kodu',
    (license) => {
      expect(needsSource(license)).toBe(true)
      expect(licenseProblem({ license })).toBe('source-required')
      expect(licenseProblem({ license, links: github })).toBeNull()
    },
  )

  it('ARR nie wymaga kodu', () => {
    expect(needsSource('ARR')).toBe(false)
    expect(licenseProblem({ license: 'ARR' })).toBeNull()
  })

  it('inna licencja wymaga linku do jej tresci, nie do kodu', () => {
    expect(licenseProblem({ license: 'other' })).toBe('license-url-required')
    expect(licenseProblem({ license: 'other', licenseUrl: '  ' })).toBe('license-url-required')
    expect(licenseProblem({ license: 'other', licenseUrl: 'https://example.com/license' })).toBeNull()
  })
})

describe('link do kodu', () => {
  it.each([
    'https://github.com/someone/addon',
    'https://www.github.com/someone/addon/tree/main',
    'https://gitlab.com/group/sub/project',
    'https://codeberg.org/someone/addon',
  ])('%s przechodzi', (url) => {
    expect(isSourceUrl(url)).toBe(true)
  })

  it.each([
    'http://github.com/someone/addon',
    'https://github.com/someone',
    'https://github.com/',
    'https://example.com/someone/addon',
    'https://github.com.evil.example/someone/addon',
    'https://notgithub.com/someone/addon',
    'github.com/someone/addon',
    '',
    null,
  ])('%s nie przechodzi', (url) => {
    expect(isSourceUrl(url)).toBe(false)
  })
})

describe('regula licencji wszedzie tam, gdzie autor ja zmienia', () => {
  it('lista kontrolna autora jej uzywa', () => {
    expect(checklistState({ license: 'MIT' }).license).toBe(false)
    expect(checklistState({ license: 'MIT', links: github }).license).toBe(true)
  })

  it.each([
    'server/api/catalog/projects.post.ts',
    'server/api/catalog/project/[slug].patch.ts',
    'server/api/catalog/project/[slug]/submit.post.ts',
    'server/api/admin/catalog/projects/[id]/moderate.post.ts',
  ])('%s sprawdza licencje', (file) => {
    expect(readFileSync(file, 'utf8')).toContain('requireLicense(')
  })

  it('zalozenie projektu sprawdza licencje zanim cokolwiek zapisze', () => {
    const source = readFileSync('server/api/catalog/projects.post.ts', 'utf8')
    expect(source.indexOf('requireLicense(')).toBeLessThan(source.indexOf('createProject('))
  })
})
