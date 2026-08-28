<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'potion')!

useToolSeo('potion', 'potion')

const cat = ref<PotionCategory | 'all'>('all')
const query = ref('')
const selectedKey = ref('swiftness')
const variant = ref<PotionVariant>('base')
const format = ref<PotionFormat>('modern')
const target = ref('@p')

const potion = computed(() => potionByKey(selectedKey.value) || POTIONS[0]!)
const variants = computed(() => availableVariants(potion.value))
const form = computed(() => potion.value.forms[variant.value] || potion.value.forms.base!)
const items = computed(() => itemsFor(potion.value))

watch(potion, (p) => {
  if (!p.forms[variant.value]) variant.value = 'base'
})

const ITEM_ICONS: Record<PotionItem, string> = {
  potion: 'i-lucide-flask-round',
  splash_potion: 'i-lucide-droplets',
  lingering_potion: 'i-lucide-cloud',
  tipped_arrow: 'i-lucide-move-up-right'
}

const effectName = (key: string) => t(`potion.effects.${key}`)

const effectLabel = (e: PotionEffect) => {
  const name = e.level > 1 ? `${effectName(e.effect)} ${roman(e.level)}` : effectName(e.effect)
  return e.seconds ? `${name} (${formatDuration(e.seconds)})` : `${name} (${t('potion.instant')})`
}

const summary = (p: Potion) => {
  const effects = p.forms.base?.effects || []
  return effects.length ? effects.map(e => effectName(e.effect)).join(', ') : t('potion.noEffects')
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  return POTIONS.filter((p) => {
    if (cat.value !== 'all' && p.cat !== cat.value) return false
    if (!q) return true
    const haystack = [t(`potion.names.${p.key}`), summary(p), p.forms.base?.id || '']
    return haystack.join(' ').toLowerCase().includes(q)
  })
})

const chain = computed(() => {
  const p = potion.value
  if (!p.brew) return []

  const steps = [{ potion: 'water', ingredient: '' }]
  for (const step of p.brew) steps.push({ potion: step.result, ingredient: step.ingredient })

  const extra = variantIngredient(variant.value)
  if (extra) steps.push({ potion: p.key, ingredient: extra })

  return steps
})

const commands = computed(() =>
  items.value.map(item => ({
    item,
    value: potionCommand(form.value.id, item, format.value, target.value),
    duration: form.value.effects
      .filter(e => e.seconds)
      .map(e => formatDuration(itemDuration(e.seconds, item)))
      .join(' / ')
  })))

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('potion.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('potion.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('potion.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('potion.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
            <div class="mb-3 flex flex-wrap gap-1.5">
              <UButton
                size="xs"
                :variant="cat === 'all' ? 'subtle' : 'ghost'"
                color="neutral"
                :label="t('potion.cats.all')"
                @click="cat = 'all'"
              />
              <UButton
                v-for="c in POTION_CATEGORIES"
                :key="c"
                size="xs"
                :variant="cat === c ? 'subtle' : 'ghost'"
                color="neutral"
                :label="t(`potion.cats.${c}`)"
                @click="cat = c"
              />
            </div>

            <UInput
              v-model="query"
              size="sm"
              icon="i-lucide-search"
              class="mb-3 w-full"
              :placeholder="t('potion.search')"
            />

            <div class="flex max-h-[640px] flex-col gap-1.5 overflow-y-auto pr-1">
              <button
                v-for="p in filtered"
                :key="p.key"
                type="button"
                class="flex cursor-pointer items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors"
                :class="p.key === selectedKey ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30 hover:border-zinc-500'"
                @click="selectedKey = p.key"
              >
                <PotionBottle :potion-key="p.key" :color="p.color" :size="34" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ t(`potion.names.${p.key}`) }}</span>
                  <span class="block truncate text-xs text-dimmed">{{ summary(p) }}</span>
                </span>
                <span class="flex shrink-0 gap-1">
                  <UIcon v-if="p.forms.long" name="i-lucide-clock" class="size-3.5 text-dimmed" :title="t('potion.variants.long')" />
                  <UIcon v-if="p.forms.strong" name="i-lucide-arrow-up" class="size-3.5 text-dimmed" :title="t('potion.variants.strong')" />
                </span>
              </button>

              <p v-if="!filtered.length" class="p-3 text-sm text-muted">{{ t('potion.noMatch') }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-6 flex items-center gap-4">
                <PotionBottle :potion-key="potion.key" :color="potion.color" :size="56" />
                <div>
                  <h2 class="text-2xl font-semibold tracking-tight">{{ t(`potion.names.${potion.key}`) }}</h2>
                  <p class="font-mono text-xs text-dimmed">minecraft:{{ form.id }}</p>
                </div>
              </div>

              <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('potion.brewing') }}</div>

              <p v-if="!potion.brew" class="mb-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-muted">
                {{ t('potion.notBrewable') }}
              </p>

              <div v-else class="mb-6 flex flex-wrap items-center gap-2">
                <template v-for="(step, i) in chain" :key="i">
                  <span v-if="step.ingredient" class="flex items-center gap-1.5 text-xs text-muted">
                    <UIcon name="i-lucide-plus" class="size-3 text-dimmed" />
                    <IngredientIcon :ingredient="step.ingredient" :size="22" />
                    {{ t(`potion.ingredients.${step.ingredient}`) }}
                    <UIcon name="i-lucide-chevron-right" class="size-3.5 text-dimmed" />
                  </span>
                  <span class="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5">
                    <PotionBottle :potion-key="step.potion" :color="potionByKey(step.potion)?.color || '#385DC6'" :size="26" />
                    <span class="text-xs">{{ t(`potion.names.${step.potion}`) }}</span>
                  </span>
                </template>
              </div>

              <p v-if="potion.alt" class="-mt-4 mb-6 flex flex-wrap items-center gap-1.5 text-xs text-dimmed">
                <PotionBottle :potion-key="potion.alt.from" :color="potionByKey(potion.alt.from)?.color || '#385DC6'" :size="20" />
                <IngredientIcon :ingredient="potion.alt.ingredient" :size="20" />
                {{ t('potion.alsoFrom', {
                  from: t(`potion.names.${potion.alt.from}`),
                  ingredient: t(`potion.ingredients.${potion.alt.ingredient}`)
                }) }}
              </p>

              <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('potion.variantsTitle') }}</div>
              <div class="grid gap-2 sm:grid-cols-3">
                <button
                  v-for="v in variants"
                  :key="v"
                  type="button"
                  class="cursor-pointer rounded-2xl border p-3 text-left transition-colors"
                  :class="v === variant ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30 hover:border-zinc-500'"
                  @click="variant = v"
                >
                  <span class="block text-sm font-medium">{{ t(`potion.variants.${v}`) }}</span>
                  <span v-if="variantIngredient(v)" class="flex items-center gap-1 text-[11px] text-dimmed">
                    +
                    <IngredientIcon :ingredient="variantIngredient(v)" :size="18" />
                    {{ t(`potion.ingredients.${variantIngredient(v)}`) }}
                  </span>
                  <span class="mt-1.5 block text-xs text-muted">
                    <template v-if="potion.forms[v]!.effects.length">
                      <span v-for="(e, i) in potion.forms[v]!.effects" :key="i" class="block">{{ effectLabel(e) }}</span>
                    </template>
                    <template v-else>{{ t('potion.noEffects') }}</template>
                  </span>
                </button>
              </div>

              <p v-if="potion.forms.long && potion.forms.strong" class="mt-3 text-xs text-dimmed">
                {{ t('potion.exclusive') }}
              </p>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('potion.give') }}</div>
                <div class="flex flex-wrap items-center gap-3">
                  <UInput v-model="target" size="xs" class="w-24 font-mono" :aria-label="t('potion.target')" />
                  <USwitch
                    :model-value="format === 'legacy'"
                    size="sm"
                    :label="t('potion.legacy')"
                    :ui="{ label: 'text-xs text-muted' }"
                    @update:model-value="format = $event ? 'legacy' : 'modern'"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <div v-for="cmd in commands" :key="cmd.item" class="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <UIcon :name="ITEM_ICONS[cmd.item]" class="size-4 text-dimmed" />
                      <span class="text-sm font-medium">{{ t(`potion.items.${cmd.item}`) }}</span>
                      <span v-if="cmd.duration" class="font-mono text-xs text-dimmed">{{ cmd.duration }}</span>
                    </div>
                    <UButton
                      icon="i-lucide-copy"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :label="t('colorCodes.copy')"
                      @click="copy(cmd.value)"
                    />
                  </div>
                  <pre class="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-muted">{{ cmd.value }}</pre>
                </div>
              </div>

              <p class="mt-3 text-xs/relaxed text-dimmed">{{ t('potion.durationNote') }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('potion.ingredientsTitle') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <GlassCard v-for="ing in INGREDIENTS" :key="ing.key" v-reveal class="p-5">
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold tracking-tight">
              <IngredientIcon :ingredient="ing.key" :size="28" />
              {{ t(`potion.ingredients.${ing.key}`) }}
            </h3>
            <p class="text-sm/relaxed text-muted">{{ t(`potion.roles.${ing.key}`) }}</p>
          </GlassCard>
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
