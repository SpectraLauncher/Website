import { vi } from 'vitest'

// server/utils/** relies on Nitro auto-imports. Nitro does not boot in a unit
// test, so these few globals have to be supplied by hand — otherwise every import
// from server/utils dies on `createError is not defined`.
//
// A new global needed by a test belongs here, not in one test file.

// Home-grown instead of the real one from h3: h3 is a transitive dependency of
// Nitro, so pnpm will not let it be imported from the root, and adding it to
// package.json just for tests would be a dependency for nothing. The tests only
// look at statusCode and statusMessage, and those behave the same here.
class TestHttpError extends Error {
  statusCode: number
  statusMessage: string
  constructor(input: { statusCode?: number, statusMessage?: string }) {
    super(input.statusMessage ?? 'error')
    this.statusCode = input.statusCode ?? 500
    this.statusMessage = input.statusMessage ?? 'error'
  }
}

const g = globalThis as Record<string, unknown>

g.createError = (input: { statusCode?: number, statusMessage?: string }) => new TestHttpError(input)
g.defineEventHandler = vi.fn()
g.defineCachedEventHandler = vi.fn()

export const runtimeConfig: Record<string, unknown> = {
  adminEmails: '',
  public: { siteUrl: 'https://usespectra.app', catalogPublic: false },
}

g.useRuntimeConfig = () => runtimeConfig
