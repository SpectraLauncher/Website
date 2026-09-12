import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { dataKeys, projectKeys } from '../../app/utils/dataKeys'

// Comments talk about these names; only code counts.
const read = (file: string) => readFileSync(file, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
const slash = (file: string) => file.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

const sources = walk('app').filter(file => file.endsWith('.vue') || file.endsWith('.ts'))

describe('klucze pobran', () => {
  it('kazdy klucz jest inny', () => {
    const built = [
      dataKeys.project('a'),
      dataKeys.projectEditor('a'),
      dataKeys.projectEditable('a'),
      dataKeys.projectMembers('a'),
      dataKeys.org('a'),
      dataKeys.launcherVersion(),
      dataKeys.authProviders(),
    ]

    expect(new Set(built).size).toBe(built.length)
  })

  // Two projects sharing a key would show one project's data on the other's page.
  it('klucz niesie slug, wiec dwa projekty sie nie zlewaja', () => {
    expect(dataKeys.project('terralith')).not.toBe(dataKeys.project('distant-horizons'))
    expect(projectKeys('a')).not.toEqual(projectKeys('b'))
  })

  it('zapis unieważnia wszystko, co pokazuje ten projekt', () => {
    const keys = projectKeys('terralith', 'p1')

    expect(keys).toContain(dataKeys.project('terralith'))
    expect(keys).toContain(dataKeys.projectEditor('terralith'))
    expect(keys).toContain(dataKeys.projectMembers('terralith'))
    expect(keys).toContain(dataKeys.projectEditable('p1'))
  })

  it('bez id nie ma pustego klucza w liscie', () => {
    const keys = projectKeys('terralith')

    expect(keys).not.toContain(dataKeys.projectEditable(''))
    expect(keys.every(Boolean)).toBe(true)
  })
})

describe('nikt nie pisze kluczy z palca', () => {
  // The whole point of the registry: a refresh that names a key nothing fetches
  // under is a silent no-op, and that is exactly what used to happen.
  it('zaden useAsyncData nie sklada klucza recznie', () => {
    // The first argument to useAsyncData is the cache key. A literal there is a
    // key nothing else can name, so nothing else can invalidate it.
    const inline = /useAsyncData(?:<[^>]*>)?\(\s*(?!dataKeys\.)['`]/

    const handwritten = sources
      .filter(file => inline.test(read(file)))
      .map(slash)

    expect(handwritten).toEqual([])
  })

  it('kazdy jawny key w useFetch idzie z rejestru', () => {
    const withKey = sources.filter(file => /\n\s*key: /.test(read(file)))
      .filter(file => /useFetch/.test(read(file)))
      .filter(file => !/key: dataKeys\./.test(read(file)))
      .map(slash)

    expect(withKey).toEqual([])
  })

  it('kazde odswiezenie idzie przez useInvalidate', () => {
    const direct = sources
      .filter(file => !slash(file).endsWith('app/composables/useInvalidate.ts'))
      .filter(file => /\b(refreshNuxtData|clearNuxtData)\(/.test(read(file)))
      .map(slash)

    expect(direct).toEqual([])
  })

  it('edytor projektu odswieza takze strone publiczna', () => {
    const source = read('app/composables/useProjectEditor.ts')

    expect(source).toMatch(/invalidate\(projectKeys\(/)
    expect(source).toMatch(/dataKeys\.projectEditor/)
  })

  it('lista providerow ma jedno zrodlo', () => {
    const callers = sources
      .filter(file => !slash(file).endsWith('app/composables/useAuthProviders.ts'))
      .filter(file => read(file).includes("'/api/auth-providers'"))
      .map(slash)

    expect(callers).toEqual([])
  })
})
