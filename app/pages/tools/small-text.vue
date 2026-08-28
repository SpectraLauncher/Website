<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'small-text')!

useToolSeo('small-text', 'smallText')

const input = ref('Spectra Network')
const strip = ref(false)
const output = computed(() => toSmallCaps(input.value, strip.value))
const hasDiacritics = computed(() => /[̀-ͯ]/.test(input.value.normalize('NFD')))

const copy = async (value: string) => {
  if (!value) return
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('smallText.theText') }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('smallText.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('smallText.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('smallText.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('smallText.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm">
            <div class="flex items-center justify-between gap-4 border-b border-zinc-600/50 px-5 py-3">
              <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('smallText.inputLabel') }}</div>
              <div class="flex items-center gap-1">
                <UButton
                  v-if="hasDiacritics"
                  icon="i-lucide-accessibility"
                  size="xs"
                  :variant="strip ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t('smallText.strip')"
                  :title="t('smallText.stripHint')"
                  @click="strip = !strip"
                />
                <UButton
                  icon="i-lucide-eraser"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t('smallText.clear')"
                  @click="input = ''"
                />
              </div>
            </div>
            <textarea
              v-model="input"
              rows="5"
              :placeholder="t('smallText.placeholder')"
              class="w-full resize-none bg-transparent px-5 py-4 text-lg outline-none placeholder:text-dimmed"
            />
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm">
            <div class="flex items-center justify-between gap-4 border-b border-zinc-600/50 px-5 py-3">
              <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('smallText.outputLabel') }}</div>
              <UButton
                icon="i-lucide-copy"
                size="xs"
                variant="ghost"
                color="neutral"
                :label="t('colorCodes.copy')"
                @click="copy(output)"
              />
            </div>
            <div class="min-h-[8.5rem] break-words px-5 py-4 text-lg">
              <span v-if="output">{{ output }}</span>
              <span v-else class="text-dimmed">{{ t('smallText.empty') }}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
          <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>
          <div class="rounded-2xl bg-[#101010] p-4">
            <p class="mc-font min-h-[1.6em] text-lg" style="text-shadow: 2px 2px 0 #3F3F3F">
              <span class="text-[#AAAAAA]">&lt;Player&gt;</span>
              <span class="text-white">{{ output }}</span>
            </p>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-2 text-2xl font-semibold tracking-tight">{{ t('smallText.mapTitle') }}</h2>
        <p v-reveal class="mb-5 max-w-[62ch] text-muted">{{ t('smallText.mapSub') }}</p>

        <div class="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-13">
          <button
            v-for="c in SMALL_CAPS"
            :key="c.letter"
            type="button"
            class="cursor-pointer rounded-xl border bg-black/30 py-3 text-center backdrop-blur-sm transition-colors hover:border-zinc-500"
            :class="c.exact ? 'border-zinc-600/50' : 'border-amber-500/40'"
            :title="c.exact ? c.letter : t('smallText.substitute', { letter: c.letter })"
            @click="copy(c.small)"
          >
            <div class="text-xs text-dimmed">{{ c.letter }}</div>
            <div class="text-lg">{{ c.small }}</div>
          </button>
        </div>

        <p class="mt-4 flex items-center gap-2 text-sm text-muted">
          <span class="inline-block size-3 rounded border border-amber-500/40 bg-amber-500/10" />
          {{ t('smallText.substituteNote', { letters: SUBSTITUTES.map(s => s.letter).join(', ') }) }}
        </p>
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
