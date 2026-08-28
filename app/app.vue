<script setup lang="ts">
const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const { data: release } = useLauncherVersion()

const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')

const localeUrl = (code: string) => `${siteUrl}${switchLocalePath(code as 'en' | 'pl') || '/'}`
const canonical = computed(() => localeUrl(locale.value))
const ogLocale = computed(() =>
  (locales.value as { code: string, language: string }[])
    .find(l => l.code === locale.value)?.language.replace('-', '_') || 'en_US'
)

useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
    class: 'dark'
  },
  link: [
    { rel: 'canonical', href: canonical.value },
    ...(locales.value as { code: string, language: string }[]).map(l => ({
      rel: 'alternate',
      hreflang: l.language,
      href: localeUrl(l.code)
    })),
    { rel: 'alternate', hreflang: 'x-default', href: localeUrl('en') }
  ]
}))

defineOgImage('Spectra', {
  title: () => t('meta.title'),
  description: () => t('meta.description'),
})

useSeoMeta({
  title: () => t('meta.title'),
  description: () => t('meta.description'),
  ogTitle: () => t('meta.title'),
  ogDescription: () => t('meta.description'),
  ogType: 'website',
  ogSiteName: 'Spectra Launcher',
  ogUrl: () => canonical.value,
  ogLocale: () => ogLocale.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('meta.title'),
  twitterDescription: () => t('meta.description')
})

</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.2s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>

<template>
  <UApp>
    <div class="overflow-x-clip relative min-h-screen">
      <NuxtPage />
      <SiteFooter />
      <CookieNotice />
      <SiteAnalytics />
    </div>
  </UApp>
</template>
