// https://nuxt.com/docs/api/configuration/nuxt-config
import { TOOLS } from './app/utils/tools'
import { LEGAL_DOCUMENTS } from './shared/utils/legal'
import { DOC_PAGES } from './shared/utils/docs'

// Named NUXT_PUBLIC_CATALOG_PUBLIC because the value has to survive two
// different moments, and only that prefix works for the later one.
//
// At build time it shapes robots.txt and the sitemap's exclude list below, which
// are module options and are fixed when the bundle is made. At run time Nuxt
// overrides runtimeConfig.public.catalogPublic from the env var named after the
// key path - which is this name, and nothing else. Read under any other name the
// flag bakes as false and no deployment setting can ever move it.
//
// The image is built without the deployment's environment, so setting this only
// in the deployment opens the gate while leaving robots.txt and the sitemap shut.
// That mismatch is deliberate and one-directional: the catalog becomes reachable
// but not indexed. Opening it to crawlers as well needs a rebuild with this
// variable set.
const CATALOG_PUBLIC = process.env.NUXT_PUBLIC_CATALOG_PUBLIC === 'true'

const LEGAL_PATHS = LEGAL_DOCUMENTS.map(doc => doc.path).filter(path => path.startsWith('/legal/'))

// Every URL prefix the catalog owns. While CATALOG_PUBLIC is off these join
// PRIVATE_PATHS, which is what keeps them out of robots.txt and the sitemap.
// They are never prerendered, which is what keeps them out of llms.txt and the
// markdown mirrors nuxt-ai-ready writes for prerendered pages.
const CATALOG_PATHS = [
  '/mod', '/plugin', '/pack', '/shader', '/resourcepack', '/schematic', '/org', '/project',
  '/collection'
]

// One person's own pages. These never belong in a sitemap, whatever the catalog
// flag says, so they are listed apart from the paths that open with it.
const ACCOUNT_PATHS = [
  '/account', '/settings', '/notifications', '/library', '/collections', '/cart',
  '/projects', '/organizations', '/analytics', '/revenue', '/verification', '/seller',
  '/reports', '/oauth'
]

const PRIVATE_PATHS = [
  '/admin',
  '/login',
  '/reset-password',
  '/secret',
  '/launcher/auth',
  '/s/',
  ...ACCOUNT_PATHS,
  ...(CATALOG_PUBLIC ? [] : CATALOG_PATHS)
]

const PRERENDER = [
  '/tools',
  '/docs',
  '/docs/api',
  ...DOC_PAGES.map(slug => `/docs/${slug}`),
  ...TOOLS.filter(tool => tool.page).map(tool => `/tools/${tool.id}`),
  '/privacy',
  '/terms',
  '/cookies',
  '/legal',
  ...LEGAL_PATHS
]

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },


  runtimeConfig: {
    adminEmails: process.env.ADMIN_EMAILS || '',

    public: {

      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://usespectra.app',
      // One flag for the whole catalog, and it lives in the public config so the
      // navigation can avoid linking at routes that would answer 404. It is not a
      // secret: what protects the catalog is the server guard, not the absence
      // of a link. See server/utils/catalog-gate.ts.
      catalogPublic: CATALOG_PUBLIC,
      umamiSrc: process.env.NUXT_PUBLIC_UMAMI_SRC || '',
      umamiId: process.env.NUXT_PUBLIC_UMAMI_ID || '',
      controller: process.env.NUXT_PUBLIC_CONTROLLER || '',
      contactEmail: process.env.NUXT_PUBLIC_CONTACT_EMAIL || '',
    },
  },

  fonts: {
    providers: {
      google: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      adobe: false,
    },
    families: [
      { name: 'Inter', src: '/fonts/Inter-400.ttf', weight: 400 },
      { name: 'Inter', src: '/fonts/Inter-600.ttf', weight: 600 },
    ],
  },

  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    'nuxt-ai-ready'
  ],

  nitro: {
    // Nitro compiles the server down to es2019 by default, which predates
    // BigInt. Schematic unpacking is built on 64-bit literals (1n, 63n) because
    // that is the shape Minecraft stores block states in, and esbuild cannot
    // lower those - it passes them through and warns on every build that they
    // "may crash at run-time".
    //
    // They do not: the Dockerfile runs node:22, which has had BigInt since 10.4.
    // The target was simply older than the runtime. This affects the server
    // bundle only - the browser build is Vite's and keeps its own target.
    esbuild: {
      options: { target: 'es2022' },
    },

    hooks: {
      async compiled(nitro) {
        const { copyFile, mkdir } = await import('node:fs/promises')
        const { dirname, join } = await import('node:path')
        const { createRequire } = await import('node:module')

        const from = join(dirname(createRequire(import.meta.url).resolve('harfbuzzjs')), 'hb.wasm')
        const to = join(nitro.options.output.serverDir, 'node_modules/harfbuzzjs/hb.wasm')

        await mkdir(dirname(to), { recursive: true })
        await copyFile(from, to)
      },
    },
    prerender: {
      crawlLinks: false,
      failOnError: true,
      routes: PRERENDER.flatMap(path => [path, `/pl${path}`])
    }
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://usespectra.app',
    name: 'Spectra',
    description: 'The modern desktop launcher for modded Minecraft, plus free browser tools for players and server owners.',
    defaultLocale: 'en'
  },

  robots: {
    disallow: [...PRIVATE_PATHS, '/api/']
  },

  sitemap: {
    exclude: PRIVATE_PATHS.map(path => `${path}**`),
    sources: ['/api/__sitemap__/urls']
  },

  linkChecker: {
    skipInspections: ['no-error-response']
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Spectra Launcher',
      url: process.env.NUXT_PUBLIC_SITE_URL || 'https://usespectra.app',
      logo: '/logo.png',
      sameAs: ['https://github.com/MakotoPD/Spectra-Launcher']
    }
  },


  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://usespectra.app',
    bundle: { optimizeTranslationDirective: false },
    locales: [
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
      { code: 'pl', name: 'Polski', language: 'pl-PL', file: 'pl.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'spectra_lang',
      redirectOn: 'root'
    }
  },

  app: {
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      templateParams: { titleSeparator: '—' },
      htmlAttrs: { class: 'dark' },
      meta: [
        { name: 'theme-color', content: '#05080f' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  }
})

