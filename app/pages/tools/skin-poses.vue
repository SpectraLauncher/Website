<script setup lang="ts">
import { normaliseQuery, type SkinProfile } from '~/utils/skin'
import { POSES, RENDER_CROPS, type RenderCrop } from '~/utils/skinPose'
import { EFFECT_IDS, LIGHTS, LIGHT_IDS, type EffectId, type LightId } from '~/utils/skinStyle'

const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'skin-poses')!

useToolSeo('skin-poses', 'skinPoses')

const SIZES = [128, 256, 512, 1024]

const query = ref('Steve')
const player = ref('steve')
const loading = ref(false)
const error = ref('')
const profile = ref<SkinProfile | null>(null)

const pose = ref('default')
const crop = ref<RenderCrop>('full')
const size = ref(512)
const lightId = ref<LightId>('flat')
const effectId = ref<EffectId>('none')
const presetRim = computed(() => Math.round((LIGHTS[lightId.value]?.rim ?? 0) * 100))
const rim = ref(presetRim.value)

watch(lightId, () => { rim.value = presetRim.value })

const showCape = ref(false)
const showVoxel = ref(false)
const showTag = ref(false)

let requestId = 0

const bust = ref(0)

const renderUrl = (poseId: string, cropId: RenderCrop, px: number) => {
  const extra = [
    lightId.value === 'flat' ? '' : `&light=${lightId.value}`,
    effectId.value === 'none' ? '' : `&fx=${effectId.value}`,
    rim.value === presetRim.value ? '' : `&rim=${rim.value}`,
    showCape.value ? '&cape=1' : '',
    showVoxel.value ? '&voxel=1' : '',
    showTag.value ? '&nametag=1' : '',
    bust.value ? `&v=${bust.value}` : ''
  ].join('')

  return `/render/${poseId}/${encodeURIComponent(player.value)}/${cropId}?size=${px}${extra}`
}

async function clearCache() {
  await $fetch('/api/dev-cache', { method: 'DELETE' })
  bust.value = Date.now()
  toast.add({ title: 'Render cache cleared', icon: 'i-lucide-trash-2' })
}

const origin = computed(() => useRequestURL().origin)

const pathDocs = computed(() => [
  { name: ':type', text: `${t('skinPoses.docsType')} — ${POSES.map(p => p.id).join(', ')}` },
  { name: ':player', text: t('skinPoses.docsPlayer') },
  { name: ':crop', text: `${t('skinPoses.docsCrop')} — ${RENDER_CROPS.join(', ')}` }
])

const queryDocs = computed(() => [
  { name: 'size', values: '32-1024', text: t('skinPoses.paramSize') },
  { name: 'light', values: LIGHT_IDS.join(', '), text: t('skinPoses.paramLight') },
  { name: 'fx', values: EFFECT_IDS.join(', '), text: t('skinPoses.paramFx') },
  { name: 'rim', values: '0-200', text: t('skinPoses.paramRim') },
  { name: 'cape', values: '1', text: t('skinPoses.paramCape') },
  { name: 'voxel', values: '1', text: t('skinPoses.paramVoxel') },
  { name: 'nametag', values: '1 | text', text: t('skinPoses.paramTag') },
  { name: 'yaw', values: '-360-360', text: t('skinPoses.docsYaw') },
  { name: 'pitch', values: '-89-89', text: t('skinPoses.docsPitch') }
])

const examples = computed(() => {
  const who = encodeURIComponent(player.value)
  return [
    { label: t('skinPoses.exBasic'), path: `/render/default/${who}/full?size=256` },
    { label: t('skinPoses.exBust'), path: `/render/waving/${who}/bust?size=256&light=studio` },
    { label: t('skinPoses.exFx'), path: `/render/hero/${who}/full?size=256&light=dramatic&fx=comic` },
    { label: t('skinPoses.exCape'), path: `/render/default/${who}/full?size=256&cape=1&yaw=205&light=soft` },
    { label: t('skinPoses.exVoxel'), path: `/render/crouching/${who}/full?size=256&voxel=1&nametag=1&light=studio` },
    { label: t('skinPoses.exHead'), path: `/render/default/${who}/head?size=256&light=night` }
  ]
})

const mainUrl = computed(() => renderUrl(pose.value, crop.value, size.value))

const absoluteUrl = computed(() =>
  `${useRequestURL().origin}${mainUrl.value}`)

async function search() {
  const typed = query.value.trim()
  if (!typed) return

  const token = ++requestId
  loading.value = true
  error.value = ''

  try {
    const found = await $fetch<SkinProfile>('/api/mc-skin', { query: { q: normaliseQuery(typed) } })
    if (token !== requestId) return
    profile.value = found
    player.value = found.name.toLowerCase()
  }
  catch (e) {
    if (token !== requestId) return
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 404 ? t('skinPoses.notFound', { q: typed }) : t('skinPoses.failed')
  }
  finally {
    if (token === requestId) loading.value = false
  }
}

const copyUrl = async () => {
  await navigator.clipboard.writeText(absoluteUrl.value)
  toast.add({ title: t('skinPoses.apiCopied'), icon: 'i-lucide-check', color: 'success' })
}

const download = () => {
  const a = document.createElement('a')
  a.href = mainUrl.value
  a.download = `${player.value}-${pose.value}-${crop.value}.png`
  a.click()
}

const list = (key: string) => {
  const value = tm(key)
  return Array.isArray(value) ? (value as unknown[]) : []
}

const features = computed(() => list('skinPoses.features').map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => list('skinPoses.faq').map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('skinPoses.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('skinPoses.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <form class="flex flex-wrap items-center gap-3" @submit.prevent="search">
            <UInput
              v-model="query"
              size="lg"
              icon="i-lucide-search"
              class="min-w-0 flex-1 font-mono"
              :placeholder="t('skinPoses.searchPh')"
              :maxlength="36"
            />
            <UButton type="submit" size="lg" color="neutral" :loading="loading" :label="t('skinPoses.search')" />
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

        <div class="grid gap-4 lg:grid-cols-[1fr_740px] lg:items-start">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm lg:sticky lg:top-24">
            <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">
              {{ t(`skinPoses.poses.${pose}`) }} · {{ t(`skinPoses.crops.${crop}`) }}
            </div>

            <div class="grid min-h-[380px] place-items-center rounded-2xl bg-[#101010] p-4 [background-image:repeating-conic-gradient(#181818_0_25%,transparent_0_50%)] [background-size:16px_16px]">
              <img
                :key="mainUrl"
                :src="mainUrl"
                class="max-h-[420px] w-auto [image-rendering:pixelated]"
                :alt="`${player} ${pose}`"
              >
            </div>

            <p class="mt-3 text-xs text-dimmed">{{ t(`skinPoses.cropHint.${crop}`) }}</p>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <UButton icon="i-lucide-download" size="sm" color="neutral" :label="t('skinPoses.download')" @click="download" />
              <UButton icon="i-lucide-link" size="sm" variant="ghost" color="neutral" :label="t('skinPoses.apiCopy')" @click="copyUrl" />
              <DevOnly>
                <UButton icon="i-lucide-trash-2" size="sm" variant="ghost" color="warning" label="Clear cache" @click="clearCache" />
              </DevOnly>
            </div>
          </div>

          <div class="flex flex-col lg:flex-row gap-4">
            <div class="rounded-3xl w-full border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.crop') }}</div>
              <div class="mb-5 flex flex-wrap gap-1.5">
                <UButton
                  v-for="c in RENDER_CROPS"
                  :key="c"
                  size="xs"
                  :variant="crop === c ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`skinPoses.crops.${c}`)"
                  @click="crop = c"
                />
              </div>

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.light') }}</div>
              <div class="mb-5 flex flex-wrap gap-1.5">
                <UButton
                  v-for="l in LIGHT_IDS"
                  :key="l"
                  size="xs"
                  :variant="lightId === l ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`skinPoses.lights.${l}`)"
                  @click="lightId = l"
                />
              </div>

              <div class="mb-3 flex items-center justify-between gap-3">
                <span class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.rim') }}</span>
                <span class="font-mono text-xs text-dimmed">{{ rim }}</span>
              </div>
              <USlider v-model="rim" :min="0" :max="200" :step="5" class="mb-5" />

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.fx') }}</div>
              <div class="mb-5 flex flex-wrap gap-1.5">
                <UButton
                  v-for="f in EFFECT_IDS"
                  :key="f"
                  size="xs"
                  :variant="effectId === f ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`skinPoses.effects.${f}`)"
                  @click="effectId = f"
                />
              </div>

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.style') }}</div>
              <div class="mb-5 flex flex-col gap-2">
                <USwitch v-model="showTag" :label="t('skinPoses.styles.nametag')" size="sm" />
                <USwitch v-model="showCape" :label="t('skinPoses.styles.cape')" size="sm" />
                <USwitch v-model="showVoxel" :label="t('skinPoses.styles.voxel')" size="sm" />
              </div>

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.size') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="s in SIZES"
                  :key="s"
                  size="xs"
                  class="font-mono"
                  :variant="size === s ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="`${s}`"
                  @click="size = s"
                />
              </div>
            </div>

            <div class="rounded-3xl w-full border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.apiTitle') }}</div>

              <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.route') }}</div>
              <pre class="mb-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-muted">/render/:type/:player/:crop</pre>

              <pre class="mb-4 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-muted">{{ absoluteUrl }}</pre>

              <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.params') }}</div>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">size</code> — {{ t('skinPoses.paramSize') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">light</code> — {{ t('skinPoses.paramLight') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">fx</code> — {{ t('skinPoses.paramFx') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">rim</code> — {{ t('skinPoses.paramRim') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">yaw</code>, <code class="font-mono">pitch</code> — {{ t('skinPoses.paramCam') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">cape</code> — {{ t('skinPoses.paramCape') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">voxel</code> — {{ t('skinPoses.paramVoxel') }}</p>
              <p class="mb-3 text-xs/relaxed text-dimmed"><code class="font-mono">nametag</code> — {{ t('skinPoses.paramTag') }}</p>

              <p class="text-xs/relaxed text-dimmed">{{ t('skinPoses.apiHint') }}</p>
              <p class="mt-2 text-xs/relaxed text-dimmed">{{ t('skinPoses.renderedBy') }}</p>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.gallery') }}</div>

          <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            <button
              v-for="p in POSES"
              :key="p.id"
              type="button"
              class="cursor-pointer rounded-2xl border p-2 transition-colors"
              :class="pose === p.id ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30 hover:border-zinc-500'"
              @click="pose = p.id"
            >
              <span class="mb-1 grid aspect-square place-items-center rounded-xl bg-[#101010]">
                <img
                  :src="renderUrl(p.id, 'full', 128)"
                  loading="lazy"
                  class="max-h-full w-auto [image-rendering:pixelated]"
                  :alt="p.id"
                >
              </span>
              <span class="block truncate text-center text-[11px] text-muted">{{ t(`skinPoses.poses.${p.id}`) }}</span>
            </button>
          </div>
        </div>
      </section>


      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('skinPoses.docsTitle') }}</h2>

        <div v-reveal class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <p class="mb-4 text-sm/relaxed text-muted">{{ t('skinPoses.docsIntro') }}</p>

          <pre class="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-muted">GET {{ origin }}/render/:type/:player/:crop</pre>

          <h3 class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.docsPath') }}</h3>
          <div class="mb-6 overflow-x-auto">
            <table class="w-full min-w-[520px] border-collapse text-sm">
              <tbody>
                <tr v-for="row in pathDocs" :key="row.name" class="border-b border-white/10 align-top">
                  <td class="w-32 py-2 pr-4 font-mono text-xs">{{ row.name }}</td>
                  <td class="py-2 text-xs/relaxed text-muted">{{ row.text }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.docsQuery') }}</h3>
          <div class="mb-6 overflow-x-auto">
            <table class="w-full min-w-[520px] border-collapse text-sm">
              <tbody>
                <tr v-for="row in queryDocs" :key="row.name" class="border-b border-white/10 align-top">
                  <td class="w-28 py-2 pr-4 font-mono text-xs">{{ row.name }}</td>
                  <td class="w-40 py-2 pr-4 font-mono text-[11px] text-dimmed">{{ row.values }}</td>
                  <td class="py-2 text-xs/relaxed text-muted">{{ row.text }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinPoses.docsExamples') }}</h3>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="ex in examples" :key="ex.path" class="rounded-2xl border border-white/10 bg-black/20 p-3">
              <span class="mb-2 grid aspect-square place-items-center rounded-xl bg-[#101010] [background-image:repeating-conic-gradient(#181818_0_25%,transparent_0_50%)] [background-size:16px_16px]">
                <img :src="ex.path" loading="lazy" class="max-h-full w-auto [image-rendering:pixelated]" :alt="ex.label">
              </span>
              <p class="mb-1 text-xs font-medium">{{ ex.label }}</p>
              <code class="block break-all font-mono text-[11px] text-dimmed">{{ ex.path }}</code>
            </div>
          </div>

          <p class="mt-6 text-xs/relaxed text-dimmed">{{ t('skinPoses.docsNotes') }}</p>
        </div>
      </section>

      <section v-if="features.length" class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('locator.featuresTitle') }}</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <GlassCard v-for="f in features" :key="f.title" v-reveal class="p-6">
            <h3 class="mb-2 font-semibold tracking-tight">{{ f.title }}</h3>
            <p class="text-sm/relaxed text-muted">{{ f.body }}</p>
          </GlassCard>
        </div>
      </section>

      <section v-if="faq.length" class="container mx-auto px-4 pb-24">
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
