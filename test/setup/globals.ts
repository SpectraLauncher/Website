import { vi } from 'vitest'

// server/utils/** liczy na auto-importy Nitro. W tescie jednostkowym Nitro nie
// startuje, wiec te kilka globali trzeba podstawic recznie — inaczej kazdy import
// z server/utils wywala sie na `createError is not defined`.
//
// Nowy global potrzebny w tescie dopisz tutaj, a nie w pojedynczym pliku testowym.

// Wlasny zamiast prawdziwego z h3: h3 jest zaleznoscia przechodnia Nitro, wiec
// pnpm nie pozwala go zaimportowac z roota, a dodawanie go do package.json tylko
// pod testy to zaleznosc na nic. Testy patrza wylacznie na statusCode i
// statusMessage, a te sa tu takie same.
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
  catalogPublic: false,
  public: { siteUrl: 'https://usespectra.app' },
}

g.useRuntimeConfig = () => runtimeConfig
