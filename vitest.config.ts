import { defineConfig } from 'vitest/config'

// Testy leza w test/, a nie obok zrodel, bo Nitro skanuje server/utils/**.ts pod
// auto-import, a autoimport-check.mjs chodzi po tym samym drzewie — plik *.test.ts
// trafilby do obu.
//
// Swiadomie plain vitest, bez defineVitestConfig z @nuxt/test-utils: ten drugi
// podstawia aliasy Nuxta, przez co `useRuntimeConfig` rozwiazuje sie do wersji
// aplikacyjnej i wywala sie poza kontekstem Nuxta. Testy komponentow dostana
// wlasny projekt ze srodowiskiem 'nuxt', kiedy pojawi sie pierwszy komponent do
// przetestowania — patrz etap 6.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup/globals.ts'],
  },
})
