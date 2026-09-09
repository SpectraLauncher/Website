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
  description: () => t('meta.description')
})

useSeoMeta({
  title: () => t('meta.title'),
  description: () => t('meta.description'),
  ogTitle: () => t('meta.title'),
  ogDescription: () => t('meta.description'),
  ogType: 'website',
  ogSiteName: 'Spectra Launcher',
  ogUrl: () => canonical.value,
  ogLocale: () => ogLocale.value
})

</script>

<style>
.layout-enter-active,
.layout-leave-active {
  transition: all 0.2s;
}
.layout-enter-from,
.layout-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>

<template>
  <UApp>
    <!-- min-h-screen alone only stops the page being shorter than the viewport;
         it does not stop the footer sitting wherever the content ended. The
         column plus flex-1 is what pushes it down on a short page, which is most
         of the account pages. Same shape as error.vue. -->
    <div class="overflow-x-clip relative flex min-h-screen flex-col">
      <div class="flex-1">
        <NuxtPage />
      </div>

      <SiteFooter />
      <CreateProject />
      <CreateOrganization />
      <CreateCollection />
      <UiConfirmDialog />
      <SiteCookieNotice />
      <SiteAnalytics />
    </div>
  </UApp>
</template>
