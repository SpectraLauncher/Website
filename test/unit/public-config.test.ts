import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const config = readFileSync('nuxt.config.ts', 'utf8')

// runtimeConfig.public is resolved when the bundle is built, and the image is
// built with none of the deployment's environment (see Dockerfile: `pnpm build`
// runs before any of it exists). Whatever process.env holds at that moment is
// baked in, and at run time Nuxt will only override it from an env var named
// after the key path - NUXT_PUBLIC_<KEY>.
//
// So a public entry reading any other env var name is silently permanent. It
// looks configurable, the value is set in the deployment, and the app keeps
// serving the empty string it was built with.
function publicBlock(): string {
  const start = config.indexOf('    public: {')
  expect(start, 'nie znalazlem bloku public w nuxt.config.ts').toBeGreaterThan(-1)

  let depth = 0
  for (let i = start; i < config.length; i++) {
    if (config[i] === '{') depth++
    if (config[i] === '}') {
      depth--
      if (depth === 0) return config.slice(start, i + 1)
    }
  }

  throw new Error('blok public nie ma domkniecia')
}

describe('publiczna konfiguracja runtime', () => {
  it('czyta wylacznie zmienne z prefiksem NUXT_PUBLIC_', () => {
    const names = [...publicBlock().matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m => m[1]!)
    const wrong = names.filter(name => !name.startsWith('NUXT_PUBLIC_'))

    expect(wrong, `te nazwy nie nadpisza sie w czasie dzialania: ${wrong.join(', ')}`).toEqual([])
  })

  // The key that broke this: it was read as STRIPE_PUBLISHABLE_KEY, baked empty
  // by the Docker build, and no amount of setting it in the deployment could
  // change that. It now comes back from /api/seller/status instead.
  it('klucz publiczny Stripe nie wraca do runtimeConfig', () => {
    expect(publicBlock()).not.toMatch(/stripe/i)
  })
})

describe('klucz publiczny Stripe idzie przez API', () => {
  const status = readFileSync('server/api/seller/status.get.ts', 'utf8')
  const page = readFileSync('app/pages/seller.vue', 'utf8')

  it('serwer czyta go z srodowiska przy zadaniu', () => {
    expect(status).toContain('process.env.STRIPE_PUBLISHABLE_KEY')
  })

  // Without the secret key the server cannot mint an account session, so handing
  // the browser a publishable key would only get it as far as a failing call.
  it('nie podaje go, gdy brakuje klucza tajnego', () => {
    expect(status).toMatch(/useStripe\(\)\s*\?/)
  })

  it('strona bierze go z odpowiedzi, nie z konfiguracji builda', () => {
    expect(page).toContain('data.value?.publishableKey')
    expect(page).not.toContain('useRuntimeConfig')
  })
})
