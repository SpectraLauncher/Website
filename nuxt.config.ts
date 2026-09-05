// https://nuxt.com/docs/api/configuration/nuxt-config
import { TOOLS } from './app/utils/tools'

const CATALOG_PUBLIC = process.env.CATALOG_PUBLIC === 'true'

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
  '/account', '/settings', '/notifications', '/library', '/collections', '/billing',
  '/projects', '/organizations', '/analytics', '/revenue', '/verification', '/seller'
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
  ...TOOLS.filter(tool => tool.page).map(tool => `/tools/${tool.id}`),
  '/privacy',
  '/terms',
  '/cookies'
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
    pageTransition: { name: 'page', mode: 'out-in' },
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

