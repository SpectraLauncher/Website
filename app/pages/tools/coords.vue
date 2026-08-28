<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'coords')!

useToolSeo('coords', 'coords')

const overworld = reactive<Vec3>({ x: 1000, y: 64, z: -800 })
const nether = reactive<Vec3>({ x: 125, y: 64, z: -100 })
const fromNether = ref(false)

const syncFromOverworld = () => {
  const n = toNether(overworld)
  nether.x = n.x
  nether.y = n.y
  nether.z = n.z
}

const syncFromNether = () => {
  const o = toOverworld(nether)
  overworld.x = o.x
  overworld.y = o.y
  overworld.z = o.z
}

watch(overworld, () => { if (!fromNether.value) syncFromOverworld() })
watch(nether, () => { if (fromNether.value) syncFromNether() })

const swap = () => {
  fromNether.value = !fromNether.value
  if (fromNether.value) syncFromNether()
  else syncFromOverworld()
}

const tpTarget = ref('@s')
const tpOverworld = computed(() => tpCommand(overworld, tpTarget.value))
const tpNether = computed(() => tpCommand(nether, tpTarget.value))

const pointA = reactive<Vec3>({ x: 0, y: 64, z: 0 })
const pointB = reactive<Vec3>({ x: 1000, y: 64, z: -800 })
const dist = computed(() => distances(pointA, pointB))

const chunkPos = reactive<Vec3>({ x: 1000, y: 64, z: -800 })
const chunk = computed(() => chunkInfo(chunkPos))

const useForChunk = (v: Vec3) => {
  chunkPos.x = v.x
  chunkPos.y = v.y
  chunkPos.z = v.z
}

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const round = (n: number) => Math.round(n * 100) / 100

const features = computed(() => (tm('coords.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('coords.faq') as unknown[]).map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('coords.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('coords.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-5 flex items-center justify-between gap-4">
            <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('coords.convertTitle') }}</div>
            <UButton
              icon="i-lucide-arrow-left-right"
              size="xs"
              variant="ghost"
              color="neutral"
              :label="t('coords.swap')"
              @click="swap"
            />
          </div>

          <div class="grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]">
            <div
              class="rounded-2xl border p-5 transition-colors"
              :class="fromNether ? 'border-white/10 bg-black/20' : 'border-emerald-500/30 bg-emerald-500/[0.04]'"
            >
              <div class="mb-3 flex items-center gap-2">
                <span class="size-2.5 rounded-full bg-emerald-500" />
                <span class="text-sm font-medium">{{ t('coords.overworld') }}</span>
                <span v-if="!fromNether" class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('coords.source') }}</span>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
                  <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ axis }}</label>
                  <UInput v-model.number="overworld[axis]" type="number" :disabled="fromNether" class="w-full font-mono" />
                </div>
              </div>
            </div>

            <div class="grid place-items-center">
              <div class="rounded-full border border-white/10 bg-black/40 p-3">
                <UIcon
                  name="i-lucide-arrow-right"
                  class="size-5 text-dimmed transition-transform duration-300"
                  :class="fromNether ? 'rotate-180' : ''"
                />
              </div>
              <span class="mt-2 font-mono text-xs text-dimmed">{{ fromNether ? '× 8' : '÷ 8' }}</span>
            </div>

            <div
              class="rounded-2xl border p-5 transition-colors"
              :class="fromNether ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-white/10 bg-black/20'"
            >
              <div class="mb-3 flex items-center gap-2">
                <span class="size-2.5 rounded-full bg-red-500" />
                <span class="text-sm font-medium">{{ t('coords.nether') }}</span>
                <span v-if="fromNether" class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('coords.source') }}</span>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
                  <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ axis }}</label>
                  <UInput v-model.number="nether[axis]" type="number" :disabled="!fromNether" class="w-full font-mono" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <span class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.target') }}</span>
            <UInput v-model="tpTarget" size="sm" class="w-24 font-mono" />
          </div>

          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div v-for="cmd in [{ k: 'overworld', v: tpOverworld }, { k: 'nether', v: tpNether }]" :key="cmd.k" class="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div class="mb-2 flex items-center justify-between gap-3">
                <span class="text-xs text-dimmed">{{ t(`coords.${cmd.k}`) }}</span>
                <UButton icon="i-lucide-copy" size="xs" variant="ghost" color="neutral" :label="t('colorCodes.copy')" @click="copy(cmd.v)" />
              </div>
              <pre class="overflow-x-auto font-mono text-sm text-muted">{{ cmd.v }}</pre>
            </div>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-5 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('coords.distanceTitle') }}</div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="p in [{ label: t('coords.pointA'), v: pointA }, { label: t('coords.pointB'), v: pointB }]" :key="p.label">
                <div class="mb-2 text-xs text-muted">{{ p.label }}</div>
                <div class="grid grid-cols-3 gap-2">
                  <UInput
                    v-for="axis in (['x', 'y', 'z'] as const)"
                    :key="axis"
                    v-model.number="p.v[axis]"
                    type="number"
                    size="sm"
                    class="w-full font-mono"
                  />
                </div>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div v-for="d in [
                { label: t('coords.d3'), value: round(dist.d3), accent: true },
                { label: t('coords.d2'), value: round(dist.d2), accent: true },
                { label: 'ΔX', value: dist.dx },
                { label: 'ΔY', value: dist.dy },
                { label: 'ΔZ', value: dist.dz }
              ]" :key="d.label" class="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ d.label }}</div>
                <div class="font-mono" :class="d.accent ? 'text-lg' : 'text-sm text-muted'">{{ d.value }}</div>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('coords.chunkTitle') }}</div>
              <div class="flex gap-1.5">
                <UButton size="xs" variant="ghost" color="neutral" :label="t('coords.useOverworld')" @click="useForChunk(overworld)" />
                <UButton size="xs" variant="ghost" color="neutral" :label="t('coords.useNether')" @click="useForChunk(nether)" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div v-for="axis in (['x', 'y', 'z'] as const)" :key="axis">
                <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ axis }}</label>
                <UInput v-model.number="chunkPos[axis]" type="number" size="sm" class="w-full font-mono" />
              </div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3">
              <div v-for="row in [
                { label: t('coords.chunk'), value: `${chunk.chunkX}, ${chunk.chunkZ}` },
                { label: t('coords.inChunk'), value: `${chunk.inChunkX}, ${chunk.inChunkZ}` },
                { label: t('coords.chunkCorner'), value: `${chunk.chunkMinX}, ${chunk.chunkMinZ}` },
                { label: t('coords.region'), value: `${chunk.regionX}, ${chunk.regionZ}` }
              ]" :key="row.label" class="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ row.label }}</div>
                <div class="font-mono text-sm">{{ row.value }}</div>
              </div>
            </div>

            <button
              type="button"
              class="mt-3 w-full cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-3 text-left transition-colors hover:border-zinc-500"
              @click="copy(chunk.regionFile)"
            >
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('coords.regionFile') }}</div>
              <div class="font-mono text-sm">{{ chunk.regionFile }}</div>
            </button>
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
