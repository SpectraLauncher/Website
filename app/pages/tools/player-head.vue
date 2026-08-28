<script setup lang="ts">
import {
  SKIN_SIZE, LEGACY_COPIES, HEAD_CROP, HEAD_OVERLAY_CROP,
  isLegacySkin, normaliseQuery, stripLegacyHat,
  type SkinProfile, type UvRect
} from '~/utils/skin'
import {
  HEAD_MODES, HEAD_TARGETS, HEAD_VERSIONS, MAX_STACK,
  clampAmount, headCommand, headFileName, texturesJson,
  type HeadMode, type HeadVersion
} from '~/utils/playerHead'

const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'player-head')!

useToolSeo('player-head', 'playerHead')

const query = ref('Notch')
const loading = ref(false)
const error = ref('')
const profile = ref<SkinProfile | null>(null)
const skinCanvas = shallowRef<HTMLCanvasElement | null>(null)

const mode = ref<HeadMode>('name')
const target = ref('@p')
const amount = ref(1)
const show3d = ref(true)

let requestId = 0

const loadImage = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = url
})

const normaliseSkin = (img: HTMLImageElement) => {
  const canvas = document.createElement('canvas')
  canvas.width = SKIN_SIZE
  canvas.height = SKIN_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)

  if (isLegacySkin(img.width, img.height)) {
    for (const copy of LEGACY_COPIES) {
      ctx.save()
      ctx.translate(copy.to[0] + copy.from.w, copy.to[1])
      ctx.scale(-1, 1)
      ctx.drawImage(img, copy.from.x, copy.from.y, copy.from.w, copy.from.h, 0, 0, copy.from.w, copy.from.h)
      ctx.restore()
    }

    const pixels = ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE)
    if (stripLegacyHat(pixels.data, SKIN_SIZE)) ctx.putImageData(pixels, 0, 0)
  }

  return canvas
}

async function search() {
  const typed = query.value.trim()
  if (!typed) return

  const token = ++requestId
  const stale = () => token !== requestId

  loading.value = true
  error.value = ''
  profile.value = null
  skinCanvas.value = null

  try {
    const found = await $fetch<SkinProfile>('/api/mc-skin', { query: { q: normaliseQuery(typed) } })
    if (stale()) return
    profile.value = { ...found, model: found.model === 'slim' ? 'slim' : 'classic' }

    if (found.skin) {
      const img = await loadImage(found.skin)
      if (stale()) return
      if (img) skinCanvas.value = normaliseSkin(img)
    }
  }
  catch (e) {
    if (stale()) return
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 404 ? t('playerHead.notFound', { q: typed }) : t('playerHead.failed')
  }
  finally {
    if (!stale()) loading.value = false
  }
}

const crop = (source: HTMLCanvasElement, rect: UvRect, overlay: UvRect, scale: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = rect.w * scale
  canvas.height = rect.h * scale
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, overlay.x, overlay.y, overlay.w, overlay.h, 0, 0, canvas.width, canvas.height)
  return canvas
}

const headCanvas = computed(() =>
  (skinCanvas.value ? crop(skinCanvas.value, HEAD_CROP, HEAD_OVERLAY_CROP, 16) : null))

const headPreview = computed(() => headCanvas.value?.toDataURL('image/png') ?? '')

const textures = computed(() =>
  (profile.value?.skin && import.meta.client ? btoa(texturesJson(profile.value.skin)) : ''))

const commands = computed(() => HEAD_VERSIONS.map(version => ({
  version,
  value: headCommand({
    version,
    mode: mode.value,
    name: profile.value?.name ?? '',
    uuid: profile.value?.uuid ?? '',
    textures: textures.value,
    target: target.value,
    amount: amount.value
  })
})))

const num = (v: unknown) => (Array.isArray(v) ? Number(v[0]) : Number(v)) || 0

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const downloadHead = () => {
  const canvas = headCanvas.value
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = headFileName(profile.value?.name ?? 'player')
    a.click()
    URL.revokeObjectURL(url)
  })
}

const features = computed(() => (tm('playerHead.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('playerHead.faq') as unknown[]).map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))

onMounted(search)
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>
      <div
        class="pointer-events-none absolute left-1/2 top-16 -z-10 size-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        :style="`background: hsl(${tool.glow} 90% 55% / 0.4)`"
      ></div>

      <section class="container mx-auto px-4 pb-10 pt-48">
        <NuxtLink :to="localePath('/tools')" class="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default">
          <UIcon name="i-lucide-arrow-left" class="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {{ t('toolsPage.title') }}
        </NuxtLink>

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('playerHead.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('playerHead.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <form class="flex flex-wrap items-center gap-3" @submit.prevent="search">
            <UInput
              v-model="query"
              size="lg"
              icon="i-lucide-search"
              class="min-w-0 flex-1 font-mono"
              :placeholder="t('playerHead.searchPh')"
              :maxlength="36"
            />
            <UButton type="submit" size="lg" color="neutral" :loading="loading" :label="t('playerHead.search')" />
          </form>

          <p v-if="error" class="mt-3 flex items-center gap-2 text-sm text-red-400">
            <UIcon name="i-lucide-triangle-alert" class="size-4" />
            {{ error }}
          </p>

          <div v-else-if="profile" class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span class="font-medium">{{ profile.name }}</span>
            <span class="font-mono text-xs text-dimmed">{{ profile.uuid }}</span>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-[360px_1fr] lg:items-start">
          <div class="flex flex-col gap-4 lg:sticky lg:top-24">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('playerHead.preview') }}</div>
                <USwitch v-model="show3d" size="xs" :label="t('playerHead.view3d')" :ui="{ label: 'text-xs text-muted' }" />
              </div>

              <SkinViewer
                v-if="show3d && skinCanvas"
                :skin="skinCanvas"
                :model="profile?.model ?? 'classic'"
                :parts="['head']"
                class="!h-[260px]"
              />

              <div v-else class="grid min-h-[260px] place-items-center rounded-2xl bg-[#101010] p-4 [background-image:repeating-conic-gradient(#181818_0_25%,transparent_0_50%)] [background-size:16px_16px]">
                <img v-if="headPreview" :src="headPreview" class="w-full max-w-[200px] [image-rendering:pixelated]" alt="" >
                <span v-else class="text-sm text-muted">{{ loading ? t('playerHead.loading') : t('playerHead.noSkin') }}</span>
              </div>

              <UButton
                icon="i-lucide-download"
                size="sm"
                variant="ghost"
                color="neutral"
                class="mt-4"
                :disabled="!headCanvas"
                :label="t('playerHead.download')"
                @click="downloadHead"
              />
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="grid gap-5 sm:grid-cols-[auto_auto_1fr]">
                <div>
                  <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('playerHead.target') }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <UButton
                      v-for="s in HEAD_TARGETS"
                      :key="s"
                      size="xs"
                      class="font-mono"
                      :variant="target === s ? 'subtle' : 'ghost'"
                      color="neutral"
                      :label="s"
                      @click="target = s"
                    />
                  </div>
                  <UInput v-model="target" size="xs" class="mt-2 w-28 font-mono" />
                </div>

                <div>
                  <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('playerHead.amount') }}</div>
                  <UInput
                    :model-value="amount"
                    type="number"
                    :min="1"
                    :max="MAX_STACK"
                    size="xs"
                    class="w-24 font-mono"
                    @update:model-value="amount = clampAmount(num($event))"
                  />
                  <p class="mt-2 text-[11px] text-dimmed">{{ t('playerHead.amountHint', { max: MAX_STACK }) }}</p>
                </div>

                <div>
                  <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('playerHead.mode') }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <UButton
                      v-for="m in HEAD_MODES"
                      :key="m"
                      size="xs"
                      :variant="mode === m ? 'subtle' : 'ghost'"
                      color="neutral"
                      :label="t(`playerHead.modes.${m}`)"
                      @click="mode = m"
                    />
                  </div>
                  <p class="mt-2 max-w-[46ch] text-[11px]/relaxed text-dimmed">{{ t(`playerHead.modeHint.${mode}`) }}</p>
                </div>
              </div>
            </div>

            <div v-for="cmd in commands" :key="cmd.version" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="text-sm font-medium">{{ t(`playerHead.versions.${cmd.version}`) }}</span>
                  <UBadge variant="subtle" size="sm" :label="t(`playerHead.versionRange.${cmd.version}`)" />
                </div>
                <UButton
                  icon="i-lucide-copy"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t('colorCodes.copy')"
                  :disabled="!profile"
                  @click="copy(cmd.value)"
                />
              </div>
              <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-muted">{{ cmd.value }}</pre>
            </div>

            <p class="text-xs/relaxed text-dimmed">{{ t('playerHead.commandNote') }}</p>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('locator.featuresTitle') }}</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <GlassCard v-for="f in features" :key="f.title" v-reveal class="p-6">
            <h3 class="mb-2 font-semibold tracking-tight">{{ f.title }}</h3>
            <p class="text-sm/relaxed text-muted">{{ f.body }}</p>
          </GlassCard>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-24">
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
    </div>

    <DiscordCta />
  </div>
</template>
