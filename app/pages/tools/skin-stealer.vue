<script setup lang="ts">
import {
  SKIN_SIZE, LEGACY_COPIES, HEAD_CROP, HEAD_OVERLAY_CROP,
  capeTextureUrl, isEquipped, isLegacySkin, modCapeUrl, normaliseQuery, skinFileName, stripLegacyHat,
  type CapeEntry, type CapeSource, type OwnedCape, type SkinProfile, type UvRect
} from '~/utils/skin'

const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'skin-stealer')!

useToolSeo('skin-stealer', 'skinStealer')

const query = ref('Notch')
const loading = ref(false)
const error = ref('')
const profile = ref<SkinProfile | null>(null)
const capes = ref<CapeEntry[]>([])
const owned = ref<OwnedCape[]>([])
const degraded = ref(false)
const activeCape = ref<string | null>(null)
const spin = ref(true)

let requestId = 0

const skinCanvas = shallowRef<HTMLCanvasElement | null>(null)
const capeCanvases = shallowRef<Record<string, HTMLCanvasElement>>({})

const loadImage = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = url
})

const toCanvas = (img: HTMLImageElement, width = img.width, height = img.height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)
  return canvas
}

const normaliseSkin = (img: HTMLImageElement) => {
  if (!isLegacySkin(img.width, img.height)) return toCanvas(img)

  const canvas = document.createElement('canvas')
  canvas.width = SKIN_SIZE
  canvas.height = SKIN_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)

  for (const copy of LEGACY_COPIES) {
    ctx.save()
    ctx.translate(copy.to[0] + copy.from.w, copy.to[1])
    ctx.scale(-1, 1)
    ctx.drawImage(img, copy.from.x, copy.from.y, copy.from.w, copy.from.h, 0, 0, copy.from.w, copy.from.h)
    ctx.restore()
  }

  const pixels = ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE)
  if (stripLegacyHat(pixels.data, SKIN_SIZE)) ctx.putImageData(pixels, 0, 0)

  return canvas
}

const activeCapeCanvas = computed(() =>
  (activeCape.value ? capeCanvases.value[activeCape.value] ?? null : null))

const allCapes = computed<CapeEntry[]>(() => {
  const active = profile.value?.cape ?? null

  const official: CapeEntry[] = owned.value.map(cape => ({
    key: `mojang-${cape.slug}`,
    source: 'minecraft',
    url: capeTextureUrl(cape.hash),
    name: cape.name,
    equipped: isEquipped(cape.hash, active)
  }))

  if (!official.length && active) {
    official.push({ key: 'mojang-active', source: 'minecraft', url: active, equipped: true })
  }

  return [...official, ...capes.value]
})

async function search() {
  const typed = query.value.trim()
  if (!typed) return

  const q = normaliseQuery(typed)

  const token = ++requestId
  const stale = () => token !== requestId

  loading.value = true
  error.value = ''
  profile.value = null
  capes.value = []
  owned.value = []
  skinCanvas.value = null
  capeCanvases.value = {}
  activeCape.value = null

  try {
    const found = await $fetch<SkinProfile>('/api/mc-skin', { query: { q } })
    if (stale()) return
    profile.value = { ...found, model: found.model === 'slim' ? 'slim' : 'classic' }

    if (found.skin) {
      const img = await loadImage(found.skin)
      if (stale()) return
      if (img) skinCanvas.value = normaliseSkin(img)
    }

    const modCapes = await $fetch<{ capes: Array<{ source: CapeSource }>, owned: OwnedCape[] }>('/api/mc-capes', {
      query: { name: found.name, uuid: found.uuid }
    }).catch(() => null)
    if (stale()) return

    owned.value = Array.isArray(modCapes?.owned) ? modCapes.owned : []
    capes.value = (modCapes?.capes ?? []).map(c => ({
      key: c.source,
      source: c.source,
      url: modCapeUrl(c.source, found.name, found.uuid)
    }))
    degraded.value = !modCapes

    const loaded: Record<string, HTMLCanvasElement> = {}
    await Promise.all(allCapes.value.map(async (cape) => {
      const img = await loadImage(cape.url)
      if (img) loaded[cape.key] = toCanvas(img)
    }))
    if (stale()) return
    capeCanvases.value = loaded

    const worn = allCapes.value.find(c => c.equipped && loaded[c.key]) ?? allCapes.value.find(c => loaded[c.key])
    if (worn) activeCape.value = worn.key
  }
  catch (e) {
    if (stale()) return
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 404 ? t('skinStealer.notFound', { q: typed }) : t('skinStealer.failed')
  }
  finally {
    if (!stale()) loading.value = false
  }
}

const crop = (source: HTMLCanvasElement, rect: UvRect, overlay?: UvRect) => {
  const canvas = document.createElement('canvas')
  canvas.width = rect.w
  canvas.height = rect.h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  if (overlay) ctx.drawImage(source, overlay.x, overlay.y, overlay.w, overlay.h, 0, 0, rect.w, rect.h)
  return canvas
}

const scaleUp = (source: HTMLCanvasElement, factor: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = source.width * factor
  canvas.height = source.height * factor
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

const save = (canvas: HTMLCanvasElement, suffix: string) => {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = skinFileName(profile.value?.name ?? 'skin', suffix)
    a.click()
    URL.revokeObjectURL(url)
  })
}

const downloadSkin = () => skinCanvas.value && save(skinCanvas.value, 'skin')
const downloadHead = () => skinCanvas.value && save(scaleUp(crop(skinCanvas.value, HEAD_CROP, HEAD_OVERLAY_CROP), 8), 'head')
const downloadCape = (cape: CapeEntry) => {
  const canvas = capeCanvases.value[cape.key]
  if (canvas) save(canvas, `cape-${cape.key}`)
}

const skinPreview = computed(() => (skinCanvas.value ? scaleUp(skinCanvas.value, 4).toDataURL('image/png') : ''))
const capePreview = (key: string) => {
  const canvas = capeCanvases.value[key]
  return canvas ? scaleUp(canvas, 4).toDataURL('image/png') : ''
}

const features = computed(() => (tm('skinStealer.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('skinStealer.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('skinStealer.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('skinStealer.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <form class="flex flex-wrap items-center gap-3" @submit.prevent="search">
            <UInput
              v-model="query"
              size="lg"
              icon="i-lucide-search"
              class="min-w-0 flex-1 font-mono"
              :placeholder="t('skinStealer.searchPh')"
              :maxlength="36"
            />
            <UButton type="submit" size="lg" color="neutral" :loading="loading" :label="t('skinStealer.search')" />
          </form>

          <p v-if="error" class="mt-3 flex items-center gap-2 text-sm text-red-400">
            <UIcon name="i-lucide-triangle-alert" class="size-4" />
            {{ error }}
          </p>

          <div v-else-if="profile" class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span class="font-medium">{{ profile.name }}</span>
            <span class="font-mono text-xs text-dimmed">{{ profile.uuid }}</span>
            <UBadge variant="subtle" size="sm" :label="t(`skinStealer.models.${profile.model}`)" />
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinStealer.render') }}</div>
              <USwitch v-model="spin" size="xs" :label="t('skinStealer.spin')" :ui="{ label: 'text-xs text-muted' }" />
            </div>

            <SkinViewer
              v-if="skinCanvas"
              :skin="skinCanvas"
              :model="profile?.model ?? 'classic'"
              :cape="activeCapeCanvas"
              :spin="spin"
            />
            <div v-else class="grid h-[420px] place-items-center rounded-2xl bg-[#0b0f16] text-sm text-muted">
              {{ loading ? t('skinStealer.loading') : t('skinStealer.noSkin') }}
            </div>

            <p class="mt-3 text-xs text-dimmed">{{ t('skinStealer.renderHint') }}</p>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinStealer.texture') }}</div>

            <div class="grid place-items-center rounded-2xl bg-[#101010] p-4 [background-image:repeating-conic-gradient(#181818_0_25%,transparent_0_50%)] [background-size:16px_16px]">
              <img v-if="skinPreview" :src="skinPreview" class="w-full max-w-[256px] [image-rendering:pixelated]" alt="" >
              <div v-else class="grid h-40 place-items-center text-sm text-muted">—</div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <UButton icon="i-lucide-download" size="sm" color="neutral" :disabled="!skinCanvas" :label="t('skinStealer.downloadSkin')" @click="downloadSkin" />
              <UButton icon="i-lucide-user-square" size="sm" variant="ghost" color="neutral" :disabled="!skinCanvas" :label="t('skinStealer.downloadHead')" @click="downloadHead" />
            </div>

            <p class="mt-3 text-xs/relaxed text-dimmed">{{ t('skinStealer.textureHint') }}</p>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinStealer.capes') }}</div>
            <UButton
              v-if="activeCape"
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              :label="t('skinStealer.hideCape')"
              @click="activeCape = null"
            />
          </div>

          <p v-if="!allCapes.length" class="text-sm text-muted">
            {{ loading ? t('skinStealer.loading') : t('skinStealer.noCapes') }}
          </p>

          <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="cape in allCapes"
              :key="cape.key"
              class="rounded-2xl border p-3 transition-colors"
              :class="activeCape === cape.key ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30'"
            >
              <button
                type="button"
                class="mb-3 grid w-full cursor-pointer place-items-center rounded-xl bg-[#101010] p-3"
                :title="t('skinStealer.wear')"
                @click="activeCape = cape.key"
              >
                <img v-if="capePreview(cape.key)" :src="capePreview(cape.key)" class="max-h-24 [image-rendering:pixelated]" alt="" >
                <span v-else class="text-xs text-dimmed">{{ t('skinStealer.capeFailed') }}</span>
              </button>

              <div class="flex items-center justify-between gap-2">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">
                    {{ cape.name ?? t(`skinStealer.sources.${cape.source}`) }}
                  </span>
                  <span class="block truncate text-[11px] text-dimmed">
                    {{ cape.equipped ? t('skinStealer.equipped') : t(`skinStealer.sources.${cape.source}`) }}
                  </span>
                </span>
                <UButton
                  icon="i-lucide-download"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :disabled="!capeCanvases[cape.key]"
                  :aria-label="t('skinStealer.downloadCape')"
                  @click="downloadCape(cape)"
                />
              </div>
            </div>
          </div>

          <p v-if="degraded" class="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <UIcon name="i-lucide-triangle-alert" class="size-3.5" />
            {{ t('skinStealer.capesDegraded') }}
          </p>
          <p class="mt-3 text-xs/relaxed text-dimmed">{{ t('skinStealer.capesHint') }}</p>
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
