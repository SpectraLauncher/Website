// https://nuxt.com/docs/api/configuration/nuxt-config
import { TOOLS } from './app/utils/tools'

const PRIVATE_PATHS = [
  '/admin',
  '/account',
  '/login',
  '/reset-password',
  '/secret',
  '/launcher/auth',
  '/s/'
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
    ingestKey: process.env.SPECTRA_INGEST_KEY || '',
    public: {

      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://spectra.makoto.com.pl',
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
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    'nuxt-ai-ready',
    '@pinia/nuxt'
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

  routeRules: {
    '/**': {
      headers: {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'content-security-policy': "frame-ancestors 'self'",
        'x-frame-options': 'SAMEORIGIN',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      },
    },
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://spectra.makoto.com.pl',
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
      url: process.env.NUXT_PUBLIC_SITE_URL || 'https://spectra.makoto.com.pl',
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
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://spectra.makoto.com.pl',
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

