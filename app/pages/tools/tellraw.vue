<script setup lang="ts">
import { tellrawCommand } from '~/utils/tellraw'

const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'tellraw')!

useToolSeo('tellraw', 'tellraw')

const target = ref('@a')
const version = ref<TellrawVersion>('modern')
const placement = ref<TellrawPlacement>('chat')
const times = reactive<TitleTimes>({ ...DEFAULT_TIMES })
const openSegment = ref(0)

const segments = ref<TellrawSegment[]>([
  { ...emptySegment('Welcome to '), color: 'gray' },
  { ...emptySegment('Spectra'), color: 'gold', bold: true, hoverText: 'Click to join', clickAction: 'suggest_command', clickValue: '/server spectra' },
  { ...emptySegment('!'), color: 'gray' }
])

const addSegment = () => {
  segments.value.push(emptySegment(''))
  openSegment.value = segments.value.length - 1
}

const removeSegment = (i: number) => {
  segments.value.splice(i, 1)
  openSegment.value = Math.min(openSegment.value, segments.value.length - 1)
}

const move = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= segments.value.length) return
  const copy = [...segments.value]
  const tmp = copy[i]!
  copy[i] = copy[j]!
  copy[j] = tmp
  segments.value = copy
  openSegment.value = j
}

const command = computed(() =>
  tellrawCommand(segments.value, placement.value, version.value, target.value, times))

const jsonOnly = computed(() => segmentsToJson(segments.value, version.value))

const isTitle = computed(() => placement.value === 'title' || placement.value === 'subtitle')

const segStyle = (seg: TellrawSegment) => ({
  color: seg.color.startsWith('#') ? seg.color : bannerAwareHex(seg.color),
  textShadow: `2px 2px 0 ${shadowFor(seg.color)}`,
  fontWeight: seg.bold ? '700' : '400',
  fontStyle: seg.italic ? 'italic' : 'normal',
  textDecoration: [seg.underlined && 'underline', seg.strikethrough && 'line-through']
    .filter(Boolean).join(' ') || 'none'
})

const bannerAwareHex = (color: string) =>
  MC_COLORS.find(c => c.name.toLowerCase().replace(' ', '_') === color)?.hex || '#FFFFFF'

const shadowFor = (color: string) => {
  if (color.startsWith('#')) return mix(color, '#000000', 0.75)
  return MC_COLORS.find(c => c.name.toLowerCase().replace(' ', '_') === color)?.shadow || '#3F3F3F'
}

const namedColors = computed(() =>
  MC_COLORS.map(c => ({ id: c.name.toLowerCase().replace(' ', '_'), hex: c.hex, name: c.name })))

const copy = async (value: string) => {
  if (!value) return
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const faq = computed(() => (tm('tellraw.faq') as unknown[]).map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))

const tips = computed(() => (tm('tellraw.tips') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('tellraw.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('tellraw.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>

          <div class="mc-font relative overflow-hidden rounded-2xl bg-[#101010]">
            <div v-if="placement === 'chat'" class="p-5">
              <p class="text-lg">
                <span v-for="(seg, i) in segments" :key="i" class="group relative" :style="segStyle(seg)">
                  {{ seg.text }}
                  <span
                    v-if="seg.hoverText"
                    class="pointer-events-none absolute -top-9 left-0 z-10 hidden whitespace-nowrap rounded border border-[#2d0e5e] bg-[#100010]/95 px-2 py-1 text-sm text-white group-hover:block"
                  >{{ seg.hoverText }}</span>
                </span>
              </p>
            </div>

            <div v-else class="relative grid min-h-56 place-items-center p-6">
              <div v-if="placement === 'actionbar'" class="absolute inset-x-0 bottom-6 text-center">
                <span v-for="(seg, i) in segments" :key="i" class="text-lg" :style="segStyle(seg)">{{ seg.text }}</span>
              </div>
              <div v-else class="text-center">
                <p :class="placement === 'title' ? 'text-5xl' : 'text-xl'">
                  <span v-for="(seg, i) in segments" :key="i" :style="segStyle(seg)">{{ seg.text }}</span>
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <label class="mb-2 block text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.target') }}</label>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="s in TELLRAW_TARGETS"
                  :key="s"
                  size="xs"
                  class="font-mono"
                  :variant="target === s ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="s"
                  @click="target = s"
                />
              </div>
              <UInput v-model="target" size="sm" class="mt-2 w-full font-mono" :placeholder="t('tellraw.targetPh')" />
            </div>

            <div>
              <label class="mb-2 block text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.version') }}</label>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="v in (['modern', 'legacy'] as TellrawVersion[])"
                  :key="v"
                  size="xs"
                  :variant="version === v ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`tellraw.versions.${v}`)"
                  @click="version = v"
                />
              </div>
            </div>

            <div>
              <label class="mb-2 block text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.placement') }}</label>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="p in (['chat', 'title', 'subtitle', 'actionbar'] as TellrawPlacement[])"
                  :key="p"
                  size="xs"
                  :variant="placement === p ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`tellraw.placements.${p}`)"
                  @click="placement = p"
                />
              </div>
            </div>
          </div>

          <div v-if="isTitle" class="mt-4 flex flex-wrap items-end gap-4">
            <div v-for="k in (['fadeIn', 'stay', 'fadeOut'] as (keyof TitleTimes)[])" :key="k">
              <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t(`tellraw.times.${k}`) }}</label>
              <UInput v-model.number="times[k]" type="number" size="sm" class="w-24 font-mono" />
            </div>
            <span class="pb-2 text-xs text-dimmed">{{ t('tellraw.ticksHint') }}</span>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.segments') }}</div>
            <UButton
              icon="i-lucide-plus"
              size="xs"
              variant="ghost"
              color="neutral"
              :label="t('tellraw.addSegment')"
              @click="addSegment"
            />
          </div>

          <div class="flex flex-col gap-3">
            <div
              v-for="(seg, i) in segments"
              :key="i"
              class="rounded-2xl border border-white/10 bg-black/40"
            >
              <div class="flex items-center gap-2 p-3">
                <button
                  type="button"
                  class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  @click="openSegment = openSegment === i ? -1 : i"
                >
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="size-4 shrink-0 text-dimmed transition-transform"
                    :class="openSegment === i ? 'rotate-90' : ''"
                  />
                  <span class="size-3 shrink-0 rounded" :style="{ background: segStyle(seg).color }" />
                  <span class="truncate text-sm" :class="seg.text ? '' : 'text-dimmed'">
                    {{ seg.text || t('tellraw.emptySegment') }}
                  </span>
                  <UIcon v-if="seg.clickAction !== 'none' && seg.clickValue" name="i-lucide-mouse-pointer-click" class="size-3.5 shrink-0 text-dimmed" />
                  <UIcon v-if="seg.hoverText" name="i-lucide-message-square" class="size-3.5 shrink-0 text-dimmed" />
                </button>

                <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" :aria-label="t('banner.up')" @click="move(i, -1)" />
                <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" :aria-label="t('banner.down')" @click="move(i, 1)" />
                <UButton
                  v-if="segments.length > 1"
                  icon="i-lucide-x"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :aria-label="t('locator.remove')"
                  @click="removeSegment(i)"
                />
              </div>

              <div v-if="openSegment === i" class="border-t border-white/10 p-4">
                <UInput v-model="seg.text" size="md" class="w-full" :placeholder="t('tellraw.textPh')" />

                <div class="mt-4 flex flex-wrap items-center gap-1.5">
                  <span class="mr-1 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.colorsTitle') }}</span>
                  <button
                    v-for="c in namedColors"
                    :key="c.id"
                    type="button"
                    class="size-6 cursor-pointer rounded border transition-transform hover:scale-110"
                    :class="seg.color === c.id ? 'border-white' : 'border-white/15'"
                    :style="{ background: c.hex }"
                    :title="c.name"
                    :aria-label="c.name"
                    @click="seg.color = c.id"
                  />
                  <UPopover>
                    <button
                      type="button"
                      class="grid size-6 cursor-pointer place-items-center rounded border border-dashed border-zinc-500 text-dimmed"
                      :title="t('tellraw.hexColor')"
                    >
                      <UIcon name="i-lucide-pipette" class="size-3" />
                    </button>
                    <template #content>
                      <div class="flex flex-col gap-3 p-4">
                        <UColorPicker
                          :model-value="seg.color.startsWith('#') ? seg.color : '#FFFFFF'"
                          size="sm"
                          @update:model-value="seg.color = $event"
                        />
                        <p class="max-w-52 text-xs text-dimmed">{{ t('tellraw.hexHint') }}</p>
                      </div>
                    </template>
                  </UPopover>
                </div>

                <div class="mt-4 flex flex-wrap items-center gap-1.5">
                  <span class="mr-1 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.formatsTitle') }}</span>
                  <UButton
                    v-for="f in [
                      { key: 'bold', icon: 'i-lucide-bold' },
                      { key: 'italic', icon: 'i-lucide-italic' },
                      { key: 'underlined', icon: 'i-lucide-underline' },
                      { key: 'strikethrough', icon: 'i-lucide-strikethrough' },
                      { key: 'obfuscated', icon: 'i-lucide-shuffle' }
                    ]"
                    :key="f.key"
                    :icon="f.icon"
                    size="xs"
                    :variant="seg[f.key as 'bold'] ? 'subtle' : 'ghost'"
                    color="neutral"
                    :aria-label="f.key"
                    @click="seg[f.key as 'bold'] = !seg[f.key as 'bold']"
                  />
                </div>

                <div class="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="mb-2 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.clickEvent') }}</label>
                    <div class="mb-2 flex flex-wrap gap-1.5">
                      <UButton
                        v-for="a in CLICK_ACTIONS"
                        :key="a"
                        size="xs"
                        :variant="seg.clickAction === a ? 'subtle' : 'ghost'"
                        color="neutral"
                        :label="t(`tellraw.clickActions.${a}`)"
                        @click="seg.clickAction = a"
                      />
                    </div>
                    <UInput
                      v-if="seg.clickAction !== 'none'"
                      v-model="seg.clickValue"
                      size="sm"
                      class="w-full font-mono"
                      :placeholder="t(`tellraw.clickPh.${seg.clickAction}`)"
                    />
                  </div>

                  <div>
                    <label class="mb-2 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('tellraw.hoverText') }}</label>
                    <UInput v-model="seg.hoverText" size="sm" class="w-full" :placeholder="t('tellraw.hoverPh')" />
                    <p class="mt-2 text-xs text-dimmed">{{ t('tellraw.hoverHint') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
            <div class="mb-3 flex items-center justify-between gap-4">
              <div class="text-sm font-medium">{{ t('tellraw.commandOut') }}</div>
              <UButton icon="i-lucide-copy" size="xs" variant="ghost" color="neutral" :label="t('colorCodes.copy')" @click="copy(command)" />
            </div>
            <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-black/40 p-3 font-mono text-xs text-muted">{{ command || '—' }}</pre>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
            <div class="mb-3 flex items-center justify-between gap-4">
              <div class="text-sm font-medium">{{ t('tellraw.jsonOut') }}</div>
              <UButton icon="i-lucide-copy" size="xs" variant="ghost" color="neutral" :label="t('colorCodes.copy')" @click="copy(jsonOnly)" />
            </div>
            <div class="mb-2 text-xs text-dimmed">{{ t('tellraw.jsonHint') }}</div>
            <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-black/40 p-3 font-mono text-xs text-muted">{{ jsonOnly }}</pre>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('tellraw.tipsTitle') }}</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <GlassCard v-for="tip in tips" :key="tip.title" v-reveal class="p-6">
            <h3 class="mb-2 font-semibold tracking-tight">{{ tip.title }}</h3>
            <p class="text-sm/relaxed text-muted">{{ tip.body }}</p>
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
