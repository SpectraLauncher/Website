<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'armor-dye')!

useToolSeo('armor-dye', 'armorDye')

const MAX_DYES = 8

const used = ref<string[]>(['red', 'blue'])
const piece = ref<ArmorPiece>('chestplate')
const legacy = ref(false)
const target = ref('@p')

const addDye = (id: string) => {
  if (used.value.length >= MAX_DYES) {
    toast.add({ title: t('armorDye.maxDyes', { n: MAX_DYES }), icon: 'i-lucide-info', color: 'warning' })
    return
  }
  used.value.push(id)
}

const removeDye = (i: number) => used.value.splice(i, 1)
const clearDyes = () => { used.value = [] }

const mixed = computed(() => mixDyes(used.value) ?? UNDYED)
const command = computed(() => dyeCommand(piece.value, mixed.value, legacy.value, target.value))

const grouped = computed(() => {
  const counts = new Map<string, number>()
  for (const id of used.value) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([id, n]) => ({ dye: dyeById(id)!, n }))
})

const wanted = ref('#7F6FA0')
const matchDepth = ref(8)
const match = computed(() => matchColor(fromHex(wanted.value), matchDepth.value))

const matchGrouped = computed(() => {
  const counts = new Map<string, number>()
  for (const id of match.value.dyes) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([id, n]) => ({ dye: dyeById(id)!, n }))
})

const applyMatch = () => {
  used.value = [...match.value.dyes]
  toast.add({ title: t('armorDye.applied'), icon: 'i-lucide-check', color: 'success' })
}

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('armorDye.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('armorDye.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('armorDye.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('armorDye.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.palette') }}</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in DYES"
              :key="d.id"
              type="button"
              class="cursor-pointer rounded-xl border border-white/10 bg-black/40 p-2 transition-colors hover:border-zinc-400"
              :title="t(`banner.colors.${d.id}`)"
              @click="addDye(d.id)"
            >
              <DyeIcon :dye="d" :size="32" />
            </button>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-4 flex items-center justify-between gap-4">
              <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.currentMix') }}</div>
              <UButton
                v-if="used.length"
                icon="i-lucide-rotate-ccw"
                size="xs"
                variant="ghost"
                color="neutral"
                :label="t('banner.reset')"
                @click="clearDyes"
              />
            </div>

            <p v-if="!used.length" class="text-sm text-muted">{{ t('armorDye.noDyes') }}</p>

            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="g in grouped"
                :key="g.dye.id"
                type="button"
                class="group flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/40 py-1.5 pl-2 pr-3 transition-colors hover:border-zinc-400"
                :title="t('armorDye.removeOne')"
                @click="removeDye(used.indexOf(g.dye.id))"
              >
                <DyeIcon :dye="g.dye" :size="24" />
                <span class="text-sm">
                  <span v-if="g.n > 1" class="text-dimmed">{{ g.n }}× </span>{{ t(`banner.colors.${g.dye.id}`) }}
                </span>
                <UIcon name="i-lucide-x" class="size-3 text-dimmed opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>

            <p class="mt-3 text-xs text-dimmed">{{ t('armorDye.dyeCount', { n: used.length, max: MAX_DYES }) }}</p>

            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.hex') }}</div>
                <button type="button" class="cursor-pointer font-mono text-lg" @click="copy(toHex(mixed))">
                  {{ toHex(mixed) }}
                </button>
              </div>
              <div>
                <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.decimal') }}</div>
                <button type="button" class="cursor-pointer font-mono text-lg" @click="copy(String(mixed))">
                  {{ mixed }}
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>
            <div class="grid place-items-center rounded-2xl bg-[#101010] py-6">
              <ArmorPreview :piece="piece" :color="mixed" :scale="9" />
            </div>

            <div class="mt-4 flex flex-wrap justify-center gap-2">
              <button
                v-for="p in ARMOR_PIECES"
                :key="p"
                type="button"
                class="cursor-pointer rounded-xl border bg-black/40 p-1.5 transition-colors"
                :class="piece === p ? 'border-zinc-400' : 'border-white/10 hover:border-zinc-500'"
                :title="t(`armorDye.pieces.${p}`)"
                @click="piece = p"
              >
                <ArmorPreview :piece="p" :color="mixed" :scale="2.4" />
              </button>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 flex flex-wrap items-center gap-4">
            <div class="text-sm font-medium">{{ t('armorDye.command') }}</div>
            <USwitch
              v-model="legacy"
              size="sm"
              :label="t('armorDye.legacy')"
              :ui="{ label: 'text-sm text-muted' }"
            />
            <UInput v-model="target" size="sm" class="w-28 font-mono" />
            <UButton
              icon="i-lucide-copy"
              size="xs"
              variant="ghost"
              color="neutral"
              class="ml-auto"
              :label="t('colorCodes.copy')"
              @click="copy(command)"
            />
          </div>
          <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-black/40 p-3 font-mono text-sm text-muted">{{ command }}</pre>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-2 text-2xl font-semibold tracking-tight">{{ t('armorDye.matchTitle') }}</h2>
        <p v-reveal class="mb-5 max-w-[62ch] text-muted">{{ t('armorDye.matchSub') }}</p>

        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="grid gap-6 lg:grid-cols-[auto_1fr]">
            <div class="flex flex-col gap-3">
              <UColorPicker v-model="wanted" size="md" />
              <UInput v-model="wanted" size="sm" class="font-mono" />
            </div>

            <div>
              <div class="mb-5 flex flex-wrap items-center gap-6">
                <div>
                  <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.targetColor') }}</div>
                  <div class="flex items-center gap-3">
                    <div class="size-12 rounded-xl border border-white/10" :style="{ background: wanted }" />
                    <span class="font-mono text-sm text-muted">{{ wanted.toUpperCase() }}</span>
                  </div>
                </div>

                <UIcon name="i-lucide-arrow-right" class="size-5 text-dimmed" />

                <div>
                  <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.mixedResult') }}</div>
                  <div class="flex items-center gap-3">
                    <div class="size-12 rounded-xl border border-white/10" :style="{ background: toHex(match.color) }" />
                    <div>
                      <div class="font-mono text-sm">{{ toHex(match.color) }}</div>
                      <div class="font-mono text-xs text-dimmed">{{ match.color }}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.accuracy') }}</div>
                  <div class="text-sm" :class="match.distance === 0 ? 'text-success' : 'text-muted'">
                    {{ match.distance === 0 ? t('armorDye.exact') : t('armorDye.off', { n: Math.round(Math.sqrt(match.distance)) }) }}
                  </div>
                </div>
              </div>

              <div class="mb-4 flex flex-wrap items-center gap-2">
                <span class="mr-1 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.maxDyesLabel') }}</span>
                <UButton
                  v-for="n in [2, 4, 6, 8]"
                  :key="n"
                  size="xs"
                  :variant="matchDepth === n ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="String(n)"
                  @click="matchDepth = n"
                />
              </div>

              <div class="mb-4 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('armorDye.needed') }}</div>
              <div class="flex flex-wrap items-center gap-2">
                <div
                  v-for="g in matchGrouped"
                  :key="g.dye.id"
                  class="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 py-1.5 pl-2 pr-3"
                >
                  <DyeIcon :dye="g.dye" :size="24" />
                  <span class="text-sm">
                    <span v-if="g.n > 1" class="text-dimmed">{{ g.n }}× </span>{{ t(`banner.colors.${g.dye.id}`) }}
                  </span>
                </div>

                <UButton
                  icon="i-lucide-arrow-up"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  class="ml-2"
                  :label="t('armorDye.apply')"
                  @click="applyMatch"
                />
              </div>
            </div>
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
