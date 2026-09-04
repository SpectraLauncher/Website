import { defineConfig } from 'vitest/config'

// Tests live in test/ rather than next to their sources because Nitro scans
// server/utils/**.ts for auto-imports and autoimport-check.mjs walks the same
// tree — a *.test.ts file would be picked up by both.
//
// Deliberately plain vitest rather than defineVitestConfig from @nuxt/test-utils:
// that one installs Nuxt aliases, which makes `useRuntimeConfig` resolve to the
// app-side version and throw outside a Nuxt context. Component tests get their
// own project with the 'nuxt' environment once there is a first component worth
// testing — see stage 6.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup/globals.ts'],
  },
})
