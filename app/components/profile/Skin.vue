<script setup lang="ts">
import type { SkinAnimation } from '~/utils/mc/skin'

const props = defineProps<{
  name: string
  skin: HTMLCanvasElement | null
  cape: HTMLCanvasElement | null
  model: 'classic' | 'slim'
}>()

const { t } = useI18n()

// The viewer looks straight at you head-on, which reads flat. A few degrees off
// axis is what makes it look like a figure rather than a texture sheet.
const MODEL_YAW = -20

const expanded = ref(false)

// A held key wins over the chosen loop, so walking stops the moment W is let go
// and the pose returns to whatever the buttons last selected.
const base = ref<SkinAnimation>('none')
const held = ref(new Set<string>())

const animation = computed<SkinAnimation>(() =>
  held.value.has('crouch') ? 'crouch' : held.value.has('walk') ? 'walk' : base.value)

const WALK_KEYS = new Set(['w', 'arrowup', 's', 'arrowdown'])

function bind(event: KeyboardEvent, down: boolean) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

  const key = event.key.toLowerCase()
  const action = key === 'shift' ? 'crouch' : WALK_KEYS.has(key) ? 'walk' : ''
  if (!action) return

  const next = new Set(held.value)
  down ? next.add(action) : next.delete(action)
  held.value = next
}

const onDown = (e: KeyboardEvent) => bind(e, true)
const onUp = (e: KeyboardEvent) => bind(e, false)
const onBlur = () => { held.value = new Set() }

onMounted(() => {
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onDown)
  window.removeEventListener('keyup', onUp)
  window.removeEventListener('blur', onBlur)
})

// To add a pose: an entry here and a branch in SkinViewer's animation prop.
const ANIMATIONS: Array<{ id: SkinAnimation, icon: string, label: string }> = [
  { id: 'none', icon: 'i-pixelarticons-avatar-circle', label: 'profile.animIdle' },
  { id: 'walk', icon: 'i-pixelarticons-human-run', label: 'profile.animWalk' },
  { id: 'crouch', icon: 'i-pixelarticons-arrow-bar-down', label: 'profile.animCrouch' },
]

const fallback = computed(() =>
  `/render/default/${encodeURIComponent(props.name)}/full?size=512&light=studio&yaw=${MODEL_YAW}`)
</script>

<template>
  <!-- The width lives here rather than on whatever holds this component, so one
       toggle moves both sides of the figure and it keeps its proportions. -->
  <div
    class="flex flex-col gap-2 transition-[width] duration-300"
    :class="expanded ? 'w-64 sm:w-80' : 'w-40'"
  >
    <div
      class="relative overflow-hidden rounded-2xl border border-raised-line bg-raised transition-[height] duration-300"
      :class="expanded ? 'h-[26rem] sm:h-[32rem]' : 'h-64'"
    >
      <SkinViewer
        v-if="skin"
        :skin="skin"
        :cape="cape"
        :model="model"
        :animation="animation"
        :yaw="-MODEL_YAW"
        :spin="false"
        class="!h-full !bg-transparent"
      />
      <img
        v-else
        :src="fallback"
        :alt="name"
        class="size-full object-contain [image-rendering:pixelated]"
      >
    </div>

    <div class="flex gap-1.5">
      <UTooltip v-for="anim in ANIMATIONS" :key="anim.id" :text="t(anim.label)">
        <UButton
          size="sm"
          color="neutral"
          :variant="base === anim.id ? 'subtle' : 'ghost'"
          :icon="anim.icon"
          :aria-label="t(anim.label)"
          @click="base = anim.id"
        />
      </UTooltip>

      <UButton
        class="ml-auto"
        size="sm"
        color="neutral"
        variant="ghost"
        :icon="expanded ? 'i-pixelarticons-collapse' : 'i-pixelarticons-expand'"
        :aria-label="t(expanded ? 'profile.shrink' : 'profile.expand')"
        @click="expanded = !expanded"
      />
    </div>

    <p class="text-xs/relaxed text-dimmed">{{ t('profile.keysHint') }}</p>
  </div>
</template>
