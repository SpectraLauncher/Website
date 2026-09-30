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
