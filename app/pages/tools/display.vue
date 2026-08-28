<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'display')!

useToolSeo('display', 'display')

const AXES = ['x', 'y', 'z'] as const
const ROTS = ['yaw', 'pitch', 'roll'] as const

const s = reactive<DisplayState>({
  ...defaultDisplay(),
  segments: [
    { ...emptySegment('Welcome to '), color: 'gray' },
    { ...emptySegment('Spectra'), color: 'gold', bold: true }
  ]
})

const uniformScale = ref(true)
const openSegment = ref(0)
const preview = ref<{ resetView: () => void } | null>(null)

const num = (v: unknown) => (Array.isArray(v) ? Number(v[0]) : Number(v)) || 0

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const setScale = (axis: typeof AXES[number], value: unknown) => {
  const v = clamp(num(value), MIN_SCALE, MAX_SCALE)
  if (uniformScale.value) {
    s.scale.x = v
    s.scale.y = v
    s.scale.z = v
  }
  else s.scale[axis] = v
}

const resetTransform = () => {
  s.translation = { x: 0, y: 0, z: 0 }
  s.scale = { x: 1, y: 1, z: 1 }
  s.left = { ...IDENTITY }
  s.right = { ...IDENTITY }
}

const usePreset = (preset: DisplayPreset) => {
  Object.assign(s, preset.patch(defaultDisplay()))
  openSegment.value = 0
  uniformScale.value = s.scale.x === s.scale.y && s.scale.y === s.scale.z
  preview.value?.resetView()
}

const addSegment = () => {
  s.segments.push(emptySegment(''))
  openSegment.value = s.segments.length - 1
}

const removeSegment = (i: number) => {
  s.segments.splice(i, 1)
  openSegment.value = Math.min(openSegment.value, s.segments.length - 1)
}

const moveSegment = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= s.segments.length) return
  const copy = [...s.segments]
  const tmp = copy[i]!
  copy[i] = copy[j]!
  copy[j] = tmp
  s.segments = copy
  openSegment.value = j
}

const addProp = () => s.blockProps.push({ key: '', value: '' })

const command = computed(() => displayCommand(s))
const tooLong = computed(() => command.value.length > MAX_CHAT)
const kill = computed(() => killCommand(s.kind))

const versionLabels = computed(() => s.kind === 'item'
  ? { modern: '1.20.5+', legacy: '1.19.4 – 1.20.4' }
  : { modern: '1.21.5+', legacy: '1.19.4 – 1.21.4' })

const namedColors = computed(() =>
  MC_COLORS.map(c => ({ id: c.name.toLowerCase().replace(/ /g, '_'), hex: c.hex, name: c.name })))

const segDot = (seg: TellrawSegment) => mcColorHex(seg.color)

const copy = async (value: string) => {
  if (!value) return
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('display.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('display.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('display.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('display.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="grid gap-5 lg:grid-cols-[auto_auto_1fr]">
            <div>
              <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.kind') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="k in DISPLAY_KINDS"
                  :key="k"
                  size="xs"
                  :variant="s.kind === k ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`display.kinds.${k}`)"
                  @click="s.kind = k"
                />
              </div>
            </div>

            <div v-if="s.kind !== 'block'">
              <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.version') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="v in (['modern', 'legacy'] as DisplayVersion[])"
                  :key="v"
                  size="xs"
                  :variant="s.version === v ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="versionLabels[v]"
                  @click="s.version = v"
                />
              </div>
            </div>

            <div>
              <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.presets') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="p in DISPLAY_PRESETS"
                  :key="p.key"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t(`display.presetNames.${p.key}`)"
                  @click="usePreset(p)"
                />
              </div>
            </div>
          </div>

          <p v-if="s.kind !== 'block'" class="mt-4 text-xs text-dimmed">
            {{ s.kind === 'item' ? t('display.versionHintItem') : t('display.versionHintText') }}
          </p>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.preview') }}</div>
              <DisplayPreview ref="preview" :state="s" />
              <p class="mt-3 flex items-start gap-2 text-xs text-dimmed">
                <span class="mt-1 inline-block size-2 shrink-0 rounded-full bg-emerald-400"></span>
                {{ t('display.originHint') }}
              </p>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.transformation') }}</div>
                <UButton
                  icon="i-lucide-rotate-ccw"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t('banner.reset')"
                  @click="resetTransform"
                />
              </div>

              <div class="mb-5">
                <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('display.translation') }}</div>
                <div class="flex flex-col gap-2">
                  <div v-for="axis in AXES" :key="`t-${axis}`" class="flex items-center gap-3">
                    <span class="w-4 font-mono text-xs text-muted">{{ axis.toUpperCase() }}</span>
                    <USlider
                      :model-value="s.translation[axis]"
                      :min="-8"
                      :max="8"
                      :step="0.05"
                      class="flex-1"
                      @update:model-value="s.translation[axis] = num($event)"
                    />
                    <UInput
                      :model-value="s.translation[axis]"
                      type="number"
                      step="0.05"
                      size="xs"
                      class="w-20 font-mono"
                      @update:model-value="s.translation[axis] = num($event)"
                    />
                  </div>
                </div>
              </div>

              <div class="mb-5">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('display.scaleLabel') }}</span>
                  <USwitch v-model="uniformScale" size="xs" :label="t('display.uniform')" :ui="{ label: 'text-xs text-muted' }" />
                </div>
                <div class="flex flex-col gap-2">
                  <div v-for="axis in AXES" :key="`s-${axis}`" class="flex items-center gap-3">
                    <span class="w-4 font-mono text-xs text-muted">{{ axis.toUpperCase() }}</span>
                    <USlider
                      :model-value="s.scale[axis]"
                      :min="MIN_SCALE"
                      :max="MAX_SCALE"
                      :step="0.05"
                      class="flex-1"
                      @update:model-value="setScale(axis, $event)"
                    />
                    <UInput
                      :model-value="s.scale[axis]"
                      type="number"
                      step="0.05"
                      size="xs"
                      class="w-20 font-mono"
                      @update:model-value="setScale(axis, $event)"
                    />
                  </div>
                </div>
              </div>

              <div v-for="side in (['left', 'right'] as const)" :key="side" class="mb-5 last:mb-0">
                <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">
                  {{ side === 'left' ? t('display.leftRotation') : t('display.rightRotation') }}
                </div>
                <div class="flex flex-col gap-2">
                  <div v-for="k in ROTS" :key="`${side}-${k}`" class="flex items-center gap-3">
                    <span class="w-12 text-xs text-muted">{{ t(`display.rot.${k}`) }}</span>
                    <USlider
                      :model-value="s[side][k]"
                      :min="-180"
                      :max="180"
                      :step="1"
                      class="flex-1"
                      @update:model-value="s[side][k] = num($event)"
                    />
                    <UInput
                      :model-value="s[side][k]"
                      type="number"
                      step="1"
                      size="xs"
                      class="w-20 font-mono"
                      @update:model-value="s[side][k] = num($event)"
                    />
                  </div>
                </div>
              </div>

              <p class="mt-4 text-xs/relaxed text-dimmed">{{ t('display.orderHint') }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.command') }}</div>
                <UButton
                  icon="i-lucide-copy"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t('colorCodes.copy')"
                  @click="copy(command)"
                />
              </div>

              <div class="mb-3 flex flex-wrap items-center gap-2">
                <span class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('display.position') }}</span>
                <UInput v-for="axis in AXES" :key="`p-${axis}`" v-model="s.pos[axis]" size="xs" class="w-20 font-mono" />
              </div>

              <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-muted">{{ command }}</pre>

              <p v-if="tooLong" class="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                <UIcon name="i-lucide-triangle-alert" class="size-3.5" />
                {{ t('display.tooLong', { n: command.length, max: MAX_CHAT }) }}
              </p>

              <div class="mt-4 flex flex-wrap items-center gap-2">
                <span class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('display.killLabel') }}</span>
                <code class="rounded bg-black/50 px-2 py-1 font-mono text-xs text-muted">{{ kill }}</code>
                <UButton icon="i-lucide-copy" size="xs" variant="ghost" color="neutral" :aria-label="t('colorCodes.copy')" @click="copy(kill)" />
              </div>
            </div>

            <div v-if="s.kind === 'text'" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.textSegments') }}</div>
                <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="neutral" :label="t('display.addSegment')" @click="addSegment" />
              </div>

              <div class="flex flex-col gap-3">
                <div v-for="(seg, i) in s.segments" :key="i" class="rounded-2xl border border-white/10 bg-black/40">
                  <div class="flex items-center gap-2 p-3">
                    <button type="button" class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left" @click="openSegment = openSegment === i ? -1 : i">
                      <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform" :class="openSegment === i ? 'rotate-90' : ''" />
                      <span class="size-3 shrink-0 rounded" :style="{ background: segDot(seg) }" />
                      <span class="truncate text-sm" :class="seg.text ? '' : 'text-dimmed'">
                        {{ seg.text.replace(/\n/g, '⏎') || t('display.emptySegment') }}
                      </span>
                    </button>
                    <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" :aria-label="t('banner.up')" @click="moveSegment(i, -1)" />
                    <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" :aria-label="t('banner.down')" @click="moveSegment(i, 1)" />
                    <UButton v-if="s.segments.length > 1" icon="i-lucide-x" size="xs" variant="ghost" color="neutral" :aria-label="t('locator.remove')" @click="removeSegment(i)" />
                  </div>

                  <div v-if="openSegment === i" class="border-t border-white/10 p-4">
                    <UInput v-model="seg.text" size="md" class="w-full" :placeholder="t('display.textPh')" />

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
                        <button type="button" class="grid size-6 cursor-pointer place-items-center rounded border border-dashed border-zinc-500 text-dimmed" :title="t('tellraw.hexColor')">
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
                      <UButton size="xs" :variant="seg.bold ? 'subtle' : 'ghost'" color="neutral" icon="i-lucide-bold" :aria-label="t('display.styles.bold')" @click="seg.bold = !seg.bold" />
                      <UButton size="xs" :variant="seg.italic ? 'subtle' : 'ghost'" color="neutral" icon="i-lucide-italic" :aria-label="t('display.styles.italic')" @click="seg.italic = !seg.italic" />
                      <UButton size="xs" :variant="seg.underlined ? 'subtle' : 'ghost'" color="neutral" icon="i-lucide-underline" :aria-label="t('display.styles.underlined')" @click="seg.underlined = !seg.underlined" />
                      <UButton size="xs" :variant="seg.strikethrough ? 'subtle' : 'ghost'" color="neutral" icon="i-lucide-strikethrough" :aria-label="t('display.styles.strikethrough')" @click="seg.strikethrough = !seg.strikethrough" />
                      <UButton size="xs" :variant="seg.obfuscated ? 'subtle' : 'ghost'" color="neutral" icon="i-lucide-shuffle" :aria-label="t('display.styles.obfuscated')" @click="seg.obfuscated = !seg.obfuscated" />
                    </div>
                  </div>
                </div>
              </div>

              <p class="mt-3 text-xs text-dimmed">{{ t('display.newlineHint', { code: '\\n' }) }}</p>
            </div>

            <div v-if="s.kind === 'text'" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.textOptions') }}</div>

              <div class="mb-4">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-muted">{{ t('display.lineWidth') }}</span>
                  <span class="font-mono">{{ Math.round(s.lineWidth) }}</span>
                </div>
                <USlider :model-value="s.lineWidth" :min="20" :max="400" :step="5" @update:model-value="s.lineWidth = num($event)" />
              </div>

              <div class="mb-4">
                <div class="mb-2 text-sm text-muted">{{ t('display.alignment') }}</div>
                <div class="flex flex-wrap gap-1.5">
                  <UButton
                    v-for="a in TEXT_ALIGNS"
                    :key="a"
                    size="xs"
                    :variant="s.align === a ? 'subtle' : 'ghost'"
                    color="neutral"
                    :label="t(`display.aligns.${a}`)"
                    @click="s.align = a"
                  />
                </div>
              </div>

              <div class="mb-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <span class="text-sm text-muted">{{ t('display.background') }}</span>
                  <USwitch v-model="s.defaultBackground" size="xs" :label="t('display.defaultBackground')" :ui="{ label: 'text-xs text-muted' }" />
                </div>

                <div v-if="!s.defaultBackground" class="flex flex-col gap-3">
                  <div class="flex items-center gap-3">
                    <UPopover>
                      <button type="button" class="size-7 cursor-pointer rounded border border-white/20" :style="{ background: s.bgColor }" :aria-label="t('display.bgColor')" />
                      <template #content>
                        <div class="p-4">
                          <UColorPicker v-model="s.bgColor" size="sm" />
                        </div>
                      </template>
                    </UPopover>
                    <span class="font-mono text-xs text-muted">{{ s.bgColor.toUpperCase() }}</span>
                  </div>

                  <div>
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted">{{ t('display.bgAlpha') }}</span>
                      <span class="font-mono">{{ Math.round(s.bgAlpha) }}</span>
                    </div>
                    <USlider :model-value="s.bgAlpha" :min="0" :max="255" @update:model-value="s.bgAlpha = num($event)" />
                    <p v-if="s.bgAlpha < MIN_VISIBLE_OPACITY" class="mt-2 text-xs text-dimmed">{{ t('display.bgHint', { n: MIN_VISIBLE_OPACITY }) }}</p>
                  </div>
                </div>
              </div>

              <div class="mb-4">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-muted">{{ t('display.textOpacity') }}</span>
                  <span class="font-mono">{{ Math.round(s.textOpacity) }}</span>
                </div>
                <USlider :model-value="s.textOpacity" :min="0" :max="255" @update:model-value="s.textOpacity = num($event)" />
                <p v-if="s.textOpacity <= 3" class="mt-2 text-xs text-dimmed">{{ t('display.opacityHint') }}</p>
              </div>

              <div class="flex flex-wrap gap-4">
                <USwitch v-model="s.shadow" size="sm" :label="t('display.shadow')" :ui="{ label: 'text-sm text-muted' }" />
                <USwitch v-model="s.seeThrough" size="sm" :label="t('display.seeThrough')" :ui="{ label: 'text-sm text-muted' }" />
              </div>
            </div>

            <div v-if="s.kind === 'block'" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.blockSection') }}</div>

              <label class="mb-1.5 block text-sm text-muted">{{ t('display.blockId') }}</label>
              <UInput v-model="s.blockId" size="md" class="w-full font-mono" placeholder="grass_block" />

              <div class="mt-5 mb-2 flex items-center justify-between gap-3">
                <span class="text-sm text-muted">{{ t('display.blockProps') }}</span>
                <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="neutral" :label="t('display.addProp')" @click="addProp" />
              </div>

              <div class="flex flex-col gap-2">
                <div v-for="(prop, i) in s.blockProps" :key="i" class="flex items-center gap-2">
                  <UInput v-model="prop.key" size="xs" class="flex-1 font-mono" :placeholder="t('display.propKey')" />
                  <span class="text-dimmed">=</span>
                  <UInput v-model="prop.value" size="xs" class="flex-1 font-mono" :placeholder="t('display.propValue')" />
                  <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" :aria-label="t('locator.remove')" @click="s.blockProps.splice(i, 1)" />
                </div>
              </div>

              <p class="mt-3 text-xs text-dimmed">{{ t('display.propsHint') }}</p>
            </div>

            <div v-if="s.kind === 'item'" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.itemSection') }}</div>

              <label class="mb-1.5 block text-sm text-muted">{{ t('display.itemId') }}</label>
              <UInput v-model="s.itemId" size="md" class="w-full font-mono" placeholder="diamond_sword" />

              <label class="mb-1.5 mt-5 block text-sm text-muted">{{ t('display.itemContext') }}</label>
              <USelect v-model="s.itemContext" :items="[...ITEM_CONTEXTS]" size="md" class="w-full font-mono" />

              <p class="mt-3 text-xs text-dimmed">{{ t('display.contextHint') }}</p>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.options') }}</div>

              <div class="mb-4">
                <div class="mb-2 text-sm text-muted">{{ t('display.billboard') }}</div>
                <div class="flex flex-wrap gap-1.5">
                  <UButton
                    v-for="b in BILLBOARDS"
                    :key="b"
                    size="xs"
                    :variant="s.billboard === b ? 'subtle' : 'ghost'"
                    color="neutral"
                    :label="t(`display.billboards.${b}`)"
                    @click="s.billboard = b"
                  />
                </div>
                <p class="mt-2 text-xs text-dimmed">{{ t('display.billboardHint') }}</p>
              </div>

              <div class="mb-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                <USwitch v-model="s.brightnessOverride" size="sm" :label="t('display.brightness')" :ui="{ label: 'text-sm text-muted' }" />
                <div v-if="s.brightnessOverride" class="mt-3 flex flex-col gap-3">
                  <div>
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted">{{ t('display.blockLight') }}</span>
                      <span class="font-mono">{{ Math.round(s.blockLight) }}</span>
                    </div>
                    <USlider :model-value="s.blockLight" :min="0" :max="15" @update:model-value="s.blockLight = num($event)" />
                  </div>
                  <div>
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted">{{ t('display.skyLight') }}</span>
                      <span class="font-mono">{{ Math.round(s.skyLight) }}</span>
                    </div>
                    <USlider :model-value="s.skyLight" :min="0" :max="15" @update:model-value="s.skyLight = num($event)" />
                  </div>
                </div>
              </div>

              <div class="mb-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="mb-1.5 block text-xs text-muted">{{ t('display.viewRange') }}</label>
                  <UInput :model-value="s.viewRange" type="number" step="0.5" min="0" size="xs" class="font-mono" @update:model-value="s.viewRange = num($event)" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs text-muted">{{ t('display.shadowRadius') }}</label>
                  <UInput :model-value="s.shadowRadius" type="number" step="0.25" min="0" size="xs" class="font-mono" @update:model-value="s.shadowRadius = num($event)" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs text-muted">{{ t('display.shadowStrength') }}</label>
                  <UInput :model-value="s.shadowStrength" type="number" step="0.05" min="0" size="xs" class="font-mono" @update:model-value="s.shadowStrength = num($event)" />
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-4">
                <USwitch v-model="s.glowing" size="sm" :label="t('display.glowing')" :ui="{ label: 'text-sm text-muted' }" />
                <USwitch v-model="s.glowOverride" size="sm" :label="t('display.glowOverride')" :ui="{ label: 'text-sm text-muted' }" />
                <UPopover v-if="s.glowOverride">
                  <button type="button" class="size-7 cursor-pointer rounded border border-white/20" :style="{ background: s.glowColor }" :aria-label="t('display.glowColor')" />
                  <template #content>
                    <div class="p-4">
                      <UColorPicker v-model="s.glowColor" size="sm" />
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('display.advanced') }}</div>

              <div class="grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="mb-1.5 block text-xs text-muted">{{ t('display.interpolationDuration') }}</label>
                  <UInput :model-value="s.interpolationDuration" type="number" min="0" size="xs" class="font-mono" @update:model-value="s.interpolationDuration = num($event)" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs text-muted">{{ t('display.startInterpolation') }}</label>
                  <UInput :model-value="s.startInterpolation" type="number" min="0" size="xs" class="font-mono" @update:model-value="s.startInterpolation = num($event)" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs text-muted">{{ t('display.teleportDuration') }}</label>
                  <UInput :model-value="s.teleportDuration" type="number" min="0" size="xs" class="font-mono" @update:model-value="s.teleportDuration = num($event)" />
                </div>
              </div>

              <p class="mt-3 text-xs/relaxed text-dimmed">{{ t('display.ticksHint') }}</p>
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
