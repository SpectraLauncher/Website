<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'start-file')!

useToolSeo('start-file', 'startFile')

const num = (v: unknown) => (Array.isArray(v) ? Number(v[0]) : Number(v)) || 0

const jar = ref('server.jar')
const ramGb = ref(4)
const preset = ref<FlagPreset>('aikar')
const os = ref<ServerOs>('unix')
const gui = ref(false)
const restart = ref(true)
const vector = ref(true)
const java = ref<JavaLine>(21)

const players = ref(20)
const mods = ref(0)
const estimate = computed(() => estimateRam(num(players.value), num(mods.value)))

const applyEstimate = () => {
  ramGb.value = estimate.value
  toast.add({ title: t('startFile.applied', { n: estimate.value }), icon: 'i-lucide-check', color: 'success' })
}

const opts = computed<StartFileOptions>(() => ({
  jar: jar.value,
  ramGb: Math.max(0.5, num(ramGb.value)),
  preset: preset.value,
  os: os.value,
  gui: gui.value,
  restart: restart.value,
  vector: vector.value,
  java: java.value
}))

const script = computed(() => buildScript(opts.value))
const fileName = computed(() => scriptName(os.value))

const suggestExtreme = computed(() =>
  preset.value === 'aikar' && opts.value.ramGb >= AIKAR_EXTREME_MIN_GB)

const suggestSmall = computed(() =>
  preset.value === 'aikar_extreme' && opts.value.ramGb < AIKAR_EXTREME_MIN_GB)

const copy = async () => {
  await navigator.clipboard.writeText(script.value)
  toast.add({ title: t('colorCodes.copied', { value: fileName.value }), icon: 'i-lucide-check', color: 'success' })
}

const download = () => {
  const blob = new Blob([script.value + '\n'], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName.value
  a.click()
  URL.revokeObjectURL(a.href)
}

const label = (n: number, max: number) => (n >= max ? `${max}+` : String(n))

const features = computed(() => (tm('startFile.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('startFile.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('startFile.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('startFile.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <label class="mb-2 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.jar') }}</label>
              <UInput v-model="jar" class="w-full font-mono" placeholder="server.jar" />

              <div class="mt-5">
                <div class="mb-2 flex items-center justify-between gap-3">
                  <label class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.ram') }}</label>
                  <UPopover>
                    <UButton
                      icon="i-lucide-calculator"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :label="t('startFile.calculate')"
                    />
                    <template #content>
                      <div class="w-72 p-5">
                        <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.calcTitle') }}</div>

                        <div class="mb-5">
                          <div class="mb-2 flex items-center justify-between text-sm">
                            <span class="text-muted">{{ t('startFile.players') }}</span>
                            <span class="font-mono">{{ label(num(players), MAX_PLAYERS) }}</span>
                          </div>
                          <USlider v-model="players" :min="0" :max="MAX_PLAYERS" :step="5" />
                        </div>

                        <div class="mb-5">
                          <div class="mb-2 flex items-center justify-between text-sm">
                            <span class="text-muted">{{ t('startFile.mods') }}</span>
                            <span class="font-mono">{{ label(num(mods), MAX_MODS) }}</span>
                          </div>
                          <USlider v-model="mods" :min="0" :max="MAX_MODS" :step="5" />
                        </div>

                        <div class="mb-4 rounded-xl border border-white/10 bg-black/40 p-3">
                          <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.suggested') }}</div>
                          <div class="font-mono text-2xl">{{ estimate }} GB</div>
                        </div>

                        <UButton
                          size="sm"
                          color="neutral"
                          class="w-full justify-center rounded-xl"
                          :label="t('startFile.apply')"
                          @click="applyEstimate"
                        />
                        <p class="mt-3 text-[10px] leading-relaxed text-dimmed">{{ t('startFile.calcHint') }}</p>
                      </div>
                    </template>
                  </UPopover>
                </div>

                <div class="flex items-center gap-3">
                  <UInput v-model.number="ramGb" type="number" :min="0.5" :step="0.5" class="w-24 font-mono" />
                  <span class="text-sm text-dimmed">GB</span>
                </div>
              </div>

              <div class="mt-5">
                <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.flags') }}</div>
                <div class="flex flex-col gap-1.5">
                  <UButton
                    v-for="p in FLAG_PRESETS"
                    :key="p"
                    size="sm"
                    class="justify-start"
                    :variant="preset === p ? 'subtle' : 'ghost'"
                    color="neutral"
                    :label="t(`startFile.presets.${p}`)"
                    @click="preset = p"
                  />
                </div>

                <p v-if="suggestExtreme" class="mt-3 flex items-start gap-2 text-xs text-warning">
                  <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
                  {{ t('startFile.hintExtreme') }}
                </p>
                <p v-if="suggestSmall" class="mt-3 flex items-start gap-2 text-xs text-warning">
                  <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
                  {{ t('startFile.hintSmall') }}
                </p>
                <p v-if="preset === 'zgc' && opts.ramGb < ZGC_MIN_GB" class="mt-3 flex items-start gap-2 text-xs text-warning">
                  <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
                  {{ t('startFile.hintZgcSmall', { n: ZGC_MIN_GB }) }}
                </p>

                <div v-if="preset === 'zgc'" class="mt-4">
                  <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.javaLine') }}</div>
                  <div class="flex gap-1.5">
                    <UButton
                      v-for="j in ([21, 23] as JavaLine[])"
                      :key="j"
                      size="sm"
                      :variant="java === j ? 'subtle' : 'ghost'"
                      color="neutral"
                      :label="t(`startFile.javaLines.${j}`)"
                      @click="java = j"
                    />
                  </div>
                  <p class="mt-2 text-[10px] leading-relaxed text-dimmed">{{ t('startFile.javaHint') }}</p>
                </div>
              </div>

              <div class="mt-5">
                <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('startFile.os') }}</div>
                <div class="flex gap-1.5">
                  <UButton
                    v-for="o in (['windows', 'unix'] as ServerOs[])"
                    :key="o"
                    size="sm"
                    :variant="os === o ? 'subtle' : 'ghost'"
                    color="neutral"
                    :label="t(`startFile.systems.${o}`)"
                    @click="os = o"
                  />
                </div>
              </div>

              <div class="mt-6 flex flex-col gap-3">
                <USwitch v-model="gui" size="sm" :label="t('startFile.gui')" :ui="{ label: 'text-sm text-muted' }" />
                <USwitch v-model="restart" size="sm" :label="t('startFile.restart')" :ui="{ label: 'text-sm text-muted' }" />
                <USwitch
                  v-if="preset === 'aikar' || preset === 'aikar_extreme'"
                  v-model="vector"
                  size="sm"
                  :label="t('startFile.vector')"
                  :ui="{ label: 'text-sm text-muted' }"
                />
                <p v-if="(preset === 'aikar' || preset === 'aikar_extreme') && vector" class="text-[10px] leading-relaxed text-dimmed">
                  {{ t('startFile.vectorHint') }}
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-file-terminal" class="size-4 text-dimmed" />
                <span class="font-mono text-sm">{{ fileName }}</span>
              </div>
              <div class="flex gap-1">
                <UButton icon="i-lucide-copy" size="xs" variant="ghost" color="neutral" :label="t('colorCodes.copy')" @click="copy" />
                <UButton icon="i-lucide-download" size="xs" variant="ghost" color="neutral" :label="t('startFile.download')" @click="download" />
              </div>
            </div>

            <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-[#0a0f16] p-4 font-mono text-xs leading-relaxed text-muted">{{ script }}</pre>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div v-for="row in [
                { label: t('startFile.heap'), value: `${opts.ramGb} GB` },
                { label: t('startFile.flagCount'), value: flagsFor(preset, vector, java).length },
                { label: t('startFile.file'), value: fileName }
              ]" :key="row.label" class="rounded-2xl border border-white/10 bg-black/40 p-3">
                <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ row.label }}</div>
                <div class="font-mono text-sm">{{ row.value }}</div>
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
