<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'locator')!

useToolSeo('locator', 'locator')

interface Player { uuid: string, name: string }

const query = ref('Notch')
const players = ref<Player[]>([])
const pending = ref(false)
const error = ref('')

const lookup = async () => {
  const q = query.value.trim()
  if (!q) return

  pending.value = true
  error.value = ''
  try {
    const p = await $fetch<Player>('/api/mc-profile', { query: { q } })
    if (!players.value.some(x => x.uuid === p.uuid)) players.value.unshift(p)
    query.value = ''
  } catch {
    error.value = t('locator.notFound', { q })
  } finally {
    pending.value = false
  }
}

onMounted(lookup)

const remove = (uuid: string) => {
  players.value = players.value.filter(p => p.uuid !== uuid)
}

const rows = computed(() => players.value.map(p => {
  const raw = rawColor(p.uuid)
  const ingame = locatorColor(p.uuid)
  return { ...p, raw, ingame, rawHex: toHex(raw), hex: toHex(ingame), rgb: toRgb(ingame) }
}))

const clashes = computed(() => {
  const byColor = new Map<number, typeof rows.value>()
  for (const row of rows.value) {
    const list = byColor.get(row.ingame) ?? []
    list.push(row)
    byColor.set(row.ingame, list)
  }
  return [...byColor.values()].filter(list => list.length > 1)
})

const picked = ref('#5555FF')
const pickedIngame = computed(() => toHex(setBrightness(fromHex(picked.value))))

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('locator.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('locator.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('locator.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('locator.sub') }}</p>

        <form class="mt-8 flex flex-wrap gap-3" @submit.prevent="lookup">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            size="lg"
            :placeholder="t('locator.placeholder')"
            class="w-full sm:w-96"
          />
          <UButton
            type="submit"
            size="lg"
            color="neutral"
            class="rounded-xl"
            :loading="pending"
            :label="t('locator.check')"
          />
        </form>
        <p v-if="error" class="mt-3 text-sm text-error">{{ error }}</p>
      </section>

      <section v-if="rows.length" class="container mx-auto px-4 pb-16">
        <div class="flex flex-col gap-4">
          <div
            v-for="row in rows"
            :key="row.uuid"
            class="flex flex-wrap items-center gap-5 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
          >
            <img
              :src="`https://mc-heads.net/avatar/${row.uuid}/80`"
              :alt="row.name"
              width="64"
              height="64"
              class="size-16 shrink-0 rounded-xl"
              loading="lazy"
            >

            <div class="min-w-0 flex-1">
              <div class="text-lg font-semibold tracking-tight">{{ row.name }}</div>
              <button
                type="button"
                class="cursor-pointer truncate font-mono text-xs text-dimmed transition-colors hover:text-muted"
                @click="copy(dashUuid(row.uuid))"
              >
                {{ dashUuid(row.uuid) }}
              </button>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('locator.rawLabel') }}</div>
                <button type="button" class="cursor-pointer font-mono text-xs text-muted" @click="copy(row.rawHex)">
                  {{ row.rawHex }}
                </button>
              </div>
              <div class="size-8 rounded-lg border border-white/10" :style="{ background: row.rawHex }" />
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('locator.ingameLabel') }}</div>
                <button type="button" class="cursor-pointer font-mono text-sm" :style="{ color: row.hex }" @click="copy(row.hex)">
                  {{ row.hex }}
                </button>
                <div class="font-mono text-[10px] text-dimmed">{{ row.rgb.r }}, {{ row.rgb.g }}, {{ row.rgb.b }}</div>
              </div>
              <div
                class="size-14 shrink-0 rounded-xl border border-white/10"
                :style="{ background: row.hex, boxShadow: `0 0 28px ${row.hex}55` }"
              />
            </div>

            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              :aria-label="t('locator.remove')"
              @click="remove(row.uuid)"
            />
          </div>
        </div>

        <div v-if="rows.length > 1" class="mt-5 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
          <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('locator.clashTitle') }}</div>
          <p v-if="!clashes.length" class="text-sm text-muted">{{ t('locator.clashNone') }}</p>
          <div v-for="(group, i) in clashes" v-else :key="i" class="flex items-center gap-3 text-sm">
            <div class="size-5 rounded-md border border-white/10" :style="{ background: group[0]!.hex }" />
            <span class="text-muted">{{ group.map(g => g.name).join(', ') }}</span>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-2 text-2xl font-semibold tracking-tight">{{ t('locator.pickerTitle') }}</h2>
        <p v-reveal class="mb-5 max-w-[62ch] text-muted">{{ t('locator.pickerSub') }}</p>

        <div class="flex flex-wrap items-center gap-6 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <input v-model="picked" type="color" class="size-16 cursor-pointer rounded-xl border border-white/10 bg-transparent">

          <div class="flex items-center gap-4">
            <div>
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('locator.rawLabel') }}</div>
              <div class="font-mono text-sm text-muted">{{ picked.toUpperCase() }}</div>
            </div>
            <UIcon name="i-lucide-arrow-right" class="size-5 text-dimmed" />
            <div>
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('locator.ingameLabel') }}</div>
              <button type="button" class="cursor-pointer font-mono text-sm" :style="{ color: pickedIngame }" @click="copy(pickedIngame)">
                {{ pickedIngame }}
              </button>
            </div>
            <div
              class="size-14 rounded-xl border border-white/10"
              :style="{ background: pickedIngame, boxShadow: `0 0 28px ${pickedIngame}55` }"
            />
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
