import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runtimeConfig } from '../setup/globals'

const g = globalThis as Record<string, unknown>
const requireUser = vi.fn()
const optionalUser = vi.fn()

g.requireUser = requireUser
g.optionalUser = optionalUser
g.canModerate = (user: { role?: string } | null) => ['moderator', 'admin', 'owner'].includes(user?.role ?? '')

const { requireCatalogAuthor } = await import('../../server/utils/catalog-gate')

const signedIn = (role: string | null) => {
  const user = { id: 'u1', role }
  requireUser.mockResolvedValue(user)
  optionalUser.mockResolvedValue(user)
  return user
}

const anonymous = () => {
  requireUser.mockRejectedValue(Object.assign(new Error('sign in first'), { statusCode: 401 }))
  optionalUser.mockResolvedValue(null)
}

beforeEach(() => {
  requireUser.mockReset()
  optionalUser.mockReset()
})

afterEach(() => {
  (runtimeConfig.public as Record<string, unknown>).catalogPublic = false
})

describe('zakladanie projektu przy zamknietym katalogu', () => {
  it('zwykly uzytkownik dostaje 404', async () => {
    signedIn(null)
    await expect(requireCatalogAuthor({} as never)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('anonim nie przechodzi', async () => {
    anonymous()
    await expect(requireCatalogAuthor({} as never)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('zespol moze', async () => {
    const user = signedIn('moderator')
    await expect(requireCatalogAuthor({} as never)).resolves.toBe(user)
  })
})

describe('zakladanie projektu przy otwartym katalogu', () => {
  beforeEach(() => {
    (runtimeConfig.public as Record<string, unknown>).catalogPublic = true
  })

  it('kazdy zalogowany moze', async () => {
    const user = signedIn(null)
    await expect(requireCatalogAuthor({} as never)).resolves.toBe(user)
  })

  it('anonim musi sie zalogowac', async () => {
    anonymous()
    await expect(requireCatalogAuthor({} as never)).rejects.toMatchObject({ statusCode: 401 })
  })
})

it('trasa zakladania projektu uzywa straznika autora, panel admina zostaje przy adminie', () => {
  expect(readFileSync('server/api/catalog/projects.post.ts', 'utf8')).toContain('requireCatalogAuthor(event)')
  expect(readFileSync('server/api/admin/catalog/projects.post.ts', 'utf8')).toContain('requireCatalogWrite(event)')
  expect(readFileSync('server/utils/catalog-gate.ts', 'utf8')).toMatch(/requireCatalogWrite[\s\S]*?requireAdmin\(event\)/)
})

describe('strona zakladania projektu', () => {
  const page = readFileSync('app/pages/create/project.vue', 'utf8')

  it('ma wlasna brame po stronie Nuxta, opartą o straznika autora', () => {
    expect(page).toContain("definePageMeta({ middleware: 'catalog-author' })")
    expect(readFileSync('app/middleware/catalog-author.ts', 'utf8')).toContain("gateRoute('/api/catalog/author-gate')")
    expect(readFileSync('server/api/catalog/author-gate.get.ts', 'utf8')).toContain('requireCatalogAuthor(event)')
  })

  it('nie pobiera niczego przy renderze na serwerze', () => {
    expect(page).not.toMatch(/useFetch|useAsyncData/)
  })

  it('akceptacja idzie raz, po utworzeniu i pierwszej wersji', () => {
    const create = page.indexOf("'/api/catalog/projects'")
    const version = page.indexOf('/versions`')
    const submit = page.indexOf('/submit`')
    expect(create).toBeGreaterThan(-1)
    expect(create).toBeLessThan(version)
    expect(version).toBeLessThan(submit)
  })

  it('menu tworzenia prowadzi na te strone, stary modal zniknal', () => {
    expect(readFileSync('app/components/site/Navbar.vue', 'utf8')).toContain("to: localePath('/create/project')")
    expect(readFileSync('app/app.vue', 'utf8')).not.toContain('<CreateProject')
  })
})
