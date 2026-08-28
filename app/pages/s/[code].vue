<script setup lang="ts">

const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()

const { data: release } = useLauncherVersion()
const os = useOs()

interface ShareMeta {
  code: string
  name: string | null
  mc_version: string | null
  loader: string | null
  mods: number
  size: number
  downloads: number
  created: number
  expires: number
}

const code = computed(() => String(route.params.code ?? '').toUpperCase())

const { data: meta, error } = await useFetch<ShareMeta>(
  () => `/api/share/${encodeURIComponent(code.value)}`,
  { query: { meta: '' } }
)

const deepLink = computed(() => `spectra://share/${code.value}`)

const downloadHref = computed(() => {
  const dl = release.value?.downloads
  const fallback = release.value?.releasesUrl || GITHUB_REPO
  if (!dl) return fallback
  if (os.value === 'macOS') return dl.macArm
  if (os.value === 'Linux') return dl.linuxAppImage
  return dl.winInstaller
})

function bytes(n: number) {
  if (!n) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

const expires = computed(() =>
  meta.value ? new Date(meta.value.expires).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }) : '')

useSeoMeta({
  title: () => (meta.value
    ? `${t('share.metaTitle', { name: meta.value.name || code.value })}`
    : `${t('share.notFoundTitle')}`),
  description: () => t('share.metaDescription'),
  robots: 'noindex, nofollow'
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-lg px-4 pb-24 pt-40">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-8 backdrop-blur-sm">
          <template v-if="error || !meta">
            <div class="text-center">
              <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <UIcon name="i-lucide-package-x" class="size-6 text-muted" />
              </span>
              <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('share.notFoundTitle') }}</h1>
              <p class="mt-2 text-sm/relaxed text-muted">{{ t('share.notFoundDesc') }}</p>
              <p class="mt-3 font-mono text-sm text-dimmed">{{ code }}</p>
              <UButton
                :to="localePath('/launcher')"
                class="mt-6 rounded-xl"
                size="lg"
                color="neutral"
                variant="outline"
                :label="t('share.backHome')"
              />
            </div>
          </template>

          <template v-else>
            <div class="mb-6 flex items-center gap-4">
              <span class="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <UIcon name="i-lucide-package" class="size-6 text-primary" />
              </span>
              <div class="min-w-0">
                <p class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('share.eyebrow') }}</p>
                <h1 class="truncate text-2xl font-semibold tracking-tight">{{ meta.name || code }}</h1>
              </div>
            </div>

            <div class="mb-6 grid grid-cols-2 gap-2 text-sm">
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-xs text-dimmed">{{ t('share.codeLabel') }}</p>
                <p class="font-mono text-lg tracking-[0.2em]">{{ meta.code }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-xs text-dimmed">Minecraft</p>
                <p class="font-mono">{{ meta.mc_version || '—' }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-xs text-dimmed">Loader</p>
                <p class="capitalize">{{ meta.loader || '—' }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p class="text-xs text-dimmed">{{ t('share.mods') }}</p>
                <p class="font-mono">{{ meta.mods }}</p>
              </div>
            </div>

            <UButton
              :to="deepLink"
              external
              block
              size="xl"
              color="neutral"
              class="rounded-xl"
              icon="i-lucide-download"
              :label="t('share.openBtn')"
            />
            <p class="mt-2 text-center text-xs text-dimmed">{{ t('share.openHint') }}</p>

            <div class="mt-6 border-t border-white/10 pt-5 text-center">
              <p class="mb-3 text-sm text-muted">{{ t('share.noLauncher') }}</p>
              <UButton
                :to="downloadHref"
                external
                variant="outline"
                color="neutral"
                class="rounded-xl"
                icon="i-lucide-arrow-down-to-line"
                :label="t('share.getLauncher')"
              />
            </div>

            <p class="mt-6 text-center text-xs text-dimmed">
              {{ t('share.footerMeta', { size: bytes(meta.size), downloads: meta.downloads, expires }) }}
            </p>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
