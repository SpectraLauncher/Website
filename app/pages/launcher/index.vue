<script setup lang="ts">
const localePath = useLocalePath()
const { t, tm, rt } = useI18n()

const { data: release } = useLauncherVersion()
const os = useOs()

const primaryHref = computed(() => {
  const dl = release.value?.downloads
  const fallback = release.value?.releasesUrl || GITHUB_REPO
  if (!dl) return fallback
  if (os.value === 'macOS') return dl.macArm
  if (os.value === 'Linux') return dl.linuxAppImage
  return dl.winInstaller
})

const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const pageUrl = computed(() => `${siteUrl}${localePath('/launcher')}`)
const seoTitle = computed(() => `${t('launcherPage.metaTitle')}`)

defineOgImage('Spectra', {
  title: () => t('launcherPage.metaTitle'),
  description: () => t('launcherPage.sub')
})

useSeoMeta({
  title: () => seoTitle.value,
  description: () => t('launcherPage.sub'),
  ogTitle: () => seoTitle.value,
  ogDescription: () => t('launcherPage.sub'),
  ogUrl: () => pageUrl.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => t('launcherPage.sub')
})

const list = (key: string) => {
  const value = tm(key)
  return Array.isArray(value) ? (value as unknown[]) : []
}

const SHOTS = [
  'ModalAddModsToInstanceModrinth.png',
  'InstanceScreen.png',
  'WorldsScreen.png'
]

const rows = computed(() => list('launcherPage.rows').map((x, i) => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body),
  shot: SHOTS[i] ?? SHOTS[0]!
})))

const EXTRA_ICONS = [
  'i-lucide-zap',
  'i-lucide-server',
  'i-lucide-life-buoy',
  'i-lucide-import',
  'i-lucide-palette',
  'i-lucide-user-round-check'
]

const extras = computed(() => list('launcherPage.extras').map((x, i) => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body),
  icon: EXTRA_ICONS[i] ?? 'i-lucide-check'
})))

const account = computed(() => list('launcherPage.account').map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => list('launcherPage.faq').map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))

const PLATFORMS = [
  { id: 'windows', icon: 'i-simple-icons-windows', builds: ['winInstaller', 'winMsi'] },
  { id: 'macos', icon: 'i-simple-icons-apple', builds: ['macArm', 'macIntel'] },
  { id: 'linux', icon: 'i-simple-icons-linux', builds: ['linuxAppImage', 'linuxDeb'] }
] as const

const platforms = computed(() => PLATFORMS.map(platform => ({
  id: platform.id,
  icon: platform.icon,
  name: t(`launcherPage.platforms.${platform.id}.name`),
  sub: t(`launcherPage.platforms.${platform.id}.sub`),
  builds: platform.builds.map(key => ({
    key,
    label: t(`launcherPage.builds.${key}.label`),
    hint: t(`launcherPage.builds.${key}.hint`),
    href: release.value?.downloads?.[key] || release.value?.releasesUrl || GITHUB_REPO
  }))
})))
useSchemaOrg(computed(() => [
  defineWebPage(faq.value.length ? { '@type': ['WebPage', 'FAQPage'] } : {}),
  ...faq.value.map(entry => defineQuestion({ name: entry.label, acceptedAnswer: entry.content })),
  defineSoftwareApp({
    name: 'Spectra Launcher',
    description: t('launcherPage.sub'),
    applicationCategory: 'GameApplication',
    operatingSystem: 'Windows, macOS, Linux',
    isAccessibleForFree: true,
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
    ...(release.value?.version ? { softwareVersion: release.value.version } : {}),
    downloadUrl: release.value?.releasesUrl || GITHUB_REPO,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
  }),
  defineBreadcrumb({
    itemListElement: [
      { name: 'Spectra', item: localePath('/') },
      { name: t('nav.launcher') }
    ]
  })
]))


</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg-day.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto px-4 pb-16 pt-40">
        <div class="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <div class="mb-5 flex w-fit items-center gap-2 rounded-md bg-black/20 px-2 py-1 text-sm font-semibold backdrop-blur-sm">
              <img src="/logo-transparent.png" width="22" height="22" alt="" />
              {{ t('launcherPage.kicker') }}
            </div>

            <h1 class="mb-5 text-5xl font-semibold tracking-tight md:text-6xl">
              {{ t('launcherPage.title1') }}<br>
              <span class="text-primary">{{ t('launcherPage.title2') }}</span>
            </h1>

            <p class="mb-8 max-w-[52ch] text-lg/relaxed text-muted">{{ t('launcherPage.sub') }}</p>

            <div class="mb-6 flex flex-wrap items-center gap-3">
              <UButton
                :to="primaryHref"
                external
                size="xl"
                color="neutral"
                icon="i-lucide-download"
                class="rounded-xl"
                :label="t('hero.downloadFor', { os })"
              />
              <UButton
                to="#downloads"
                size="xl"
                variant="ghost"
                color="neutral"
                class="rounded-xl"
                :label="t('hero.allPlatforms')"
                trailing-icon="i-lucide-arrow-down"
              />
            </div>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-dimmed">
              <span v-if="release?.version" class="font-mono">{{ release.version }}</span>
              <span>Windows · macOS · Linux</span>
              <span class="font-mono">GPLv3</span>
              <span>{{ t('launcherPage.free') }}</span>
            </div>
          </div>

          <GlassCard v-reveal class="p-3">
            <img
              src="/screenshots/MainMenu.png"
              alt="Spectra Launcher"
              class="block w-full rounded-2xl"
              width="1280"
              height="800"
            />
          </GlassCard>
        </div>
      </section>
    </div>

    <section class="container mx-auto flex flex-col gap-20 px-4 py-16">
      <div
        v-for="(row, i) in rows"
        :key="row.title"
        v-reveal
        class="grid items-center gap-10 lg:grid-cols-2"
      >
        <div :class="i % 2 ? 'lg:order-2' : ''">
          <h2 class="mb-4 text-3xl font-semibold tracking-tight">{{ row.title }}</h2>
          <p class="max-w-[54ch] text-muted">{{ row.body }}</p>
        </div>
        <GlassCard class="p-2.5" :class="i % 2 ? 'lg:order-1' : ''">
          <img
            :src="`/screenshots/${row.shot}`"
            :alt="row.title"
            class="block w-full rounded-2xl"
            loading="lazy"
            width="1280"
            height="800"
          />
        </GlassCard>
      </div>
    </section>

    <section class="container mx-auto px-4 py-8">
      <h2 v-reveal class="mb-6 text-2xl font-semibold tracking-tight">{{ t('launcherPage.extrasTitle') }}</h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <GlassCard v-for="item in extras" :key="item.title" v-reveal class="p-6">
          <UIcon :name="item.icon" class="mb-3 size-5 text-primary" />
          <h3 class="mb-2 font-semibold tracking-tight">{{ item.title }}</h3>
          <p class="text-sm/relaxed text-muted">{{ item.body }}</p>
        </GlassCard>
      </div>
    </section>

    <section class="container mx-auto px-4 py-16">
      <div v-reveal class="relative overflow-hidden rounded-4xl border border-zinc-600/50 bg-black/30 p-8 backdrop-blur-sm md:p-12">
        <div
          class="pointer-events-none absolute -right-20 -top-20 size-[420px] rounded-full opacity-20 blur-3xl"
          style="background: radial-gradient(circle, rgba(99,102,241,0.9), transparent 65%)"
        ></div>

        <div class="relative grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 class="mb-4 text-3xl font-semibold tracking-tight">{{ t('launcherPage.accountTitle') }}</h2>
            <p class="mb-7 max-w-[46ch] text-muted">{{ t('launcherPage.accountSub') }}</p>
            <UButton
              :to="localePath('/login')"
              size="lg"
              color="neutral"
              class="rounded-xl"
              icon="i-lucide-user-round-plus"
              :label="t('launcherPage.accountCta')"
            />
            <p class="mt-3 text-xs text-dimmed">{{ t('launcherPage.accountNote') }}</p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="item in account"
              :key="item.title"
              class="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <h3 class="mb-1.5 text-sm font-semibold tracking-tight">{{ item.title }}</h3>
              <p class="text-xs/relaxed text-muted">{{ item.body }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="downloads" class="container mx-auto scroll-mt-28 px-4 pb-16">
      <h2 v-reveal class="mb-2 text-2xl font-semibold tracking-tight">{{ t('launcherPage.dlTitle') }}</h2>
      <p v-reveal class="mb-6 max-w-[60ch] text-sm/relaxed text-muted">{{ t('launcherPage.dlSub') }}</p>

      <div class="grid gap-4 md:grid-cols-3">
        <div
          v-for="platform in platforms"
          :key="platform.id"
          v-reveal
          class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
        >
          <div class="mb-5 flex items-center gap-3">
            <UIcon :name="platform.icon" class="size-6 shrink-0 text-muted" />
            <div>
              <h3 class="text-base font-semibold tracking-tight">{{ platform.name }}</h3>
              <p class="text-xs text-dimmed">{{ platform.sub }}</p>
            </div>
          </div>

          <div class="space-y-2">
            <ULink
              v-for="build in platform.builds"
              :key="build.key"
              :to="build.href"
              external
              class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <span class="text-sm font-medium">{{ build.label }}</span>
              <span class="shrink-0 text-xs text-dimmed">{{ build.hint }}</span>
            </ULink>
          </div>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-dimmed">
        <span v-if="release?.version" class="font-mono">{{ release.version }}</span>
        <ULink :to="release?.releasesUrl || GITHUB_REPO" external class="hover:text-default">{{ t('launcherPage.dlAll') }}</ULink>
        <ULink :to="GITHUB_REPO" external class="hover:text-default">{{ t('launcherPage.dlSource') }}</ULink>
        <span>{{ t('launcherPage.dlNote') }}</span>
      </div>
    </section>

    <section v-if="faq.length" class="container mx-auto px-4 pb-16">
      <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('colorCodes.faqTitle') }}</h2>
      <UAccordion
        :items="faq"
        :ui="{
          item: 'rounded-2xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm mb-3 px-5 border-b-0',
          trigger: 'py-4 cursor-pointer',
          body: 'pb-4 text-muted text-sm/relaxed'
        }"
      />
    </section>

    <section class="container mx-auto px-4 pb-24">
      <div v-reveal class="rounded-4xl border border-zinc-600/50 bg-black/30 p-10 text-center backdrop-blur-sm">
        <h2 class="mb-3 text-3xl font-semibold tracking-tight">{{ t('launcherPage.ctaTitle') }}</h2>
        <p class="mx-auto mb-7 max-w-[48ch] text-muted">{{ t('launcherPage.ctaSub') }}</p>
        <UButton
          :to="primaryHref"
          external
          size="xl"
          color="neutral"
          icon="i-lucide-download"
          class="rounded-xl"
          :label="t('hero.downloadFor', { os })"
        />
      </div>
    </section>

    <DiscordCta />
  </div>
</template>
