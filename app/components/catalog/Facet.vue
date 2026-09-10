<script setup lang="ts">
const props = defineProps<{
  title: string
  options: Array<{ value: string, count: number }>
  modelValue: string[]
  labelKey?: string
  // Draws the category or loader mark next to each option. Anything else — a
  // licence id, a game version — reads better as plain text.
  marks?: 'category' | 'loader'
  collapseAfter?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const { t, te } = useI18n()

const open = ref(true)
const expanded = ref(false)
const limit = computed(() => props.collapseAfter ?? 8)

const visible = computed(() =>
  expanded.value ? props.options : props.options.slice(0, limit.value))

const hidden = computed(() => Math.max(0, props.options.length - limit.value))

// A facet value is raw data — a loader name, a licence id. It gets a translation
// only when one exists, so a modded loader nobody has keyed still reads fine.
function label(value: string): string {
  const key = props.labelKey ? `${props.labelKey}.${value}` : ''
  return key && te(key) ? t(key) : value
}

function toggle(value: string) {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter(v => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}
</script>

<template>
  <section v-if="options.length" class="border-t border-raised-line py-3 first:border-t-0">
    <button
      type="button"
      class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="text-[11px] font-bold uppercase tracking-[0.1em] text-dimmed">{{ title }}</span>
      <span class="flex-1"></span>

      <UBadge
        v-if="modelValue.length"
        size="sm"
        color="primary"
        variant="subtle"
        :label="String(modelValue.length)"
      />
      <UIcon
        name="i-pixelarticons-chevron-down"
        class="size-3.5 shrink-0 text-dimmed transition-transform"
        :class="!open && '-rotate-90'"
      />
    </button>

    <template v-if="open">
      <ul class="mt-1.5 space-y-0.5">
        <li v-for="option in visible" :key="option.value">
          <label
            class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
            :class="modelValue.includes(option.value) ? 'bg-white/5' : 'hover:bg-white/5'"
          >
            <input
              type="checkbox"
              class="size-3.5 shrink-0 accent-primary"
              :checked="modelValue.includes(option.value)"
              @change="toggle(option.value)"
            >
            <IconCategory v-if="marks === 'category'" :name="option.value" />
            <IconLoader v-else-if="marks === 'loader'" :name="option.value" />

            <span
              class="min-w-0 flex-1 truncate text-sm"
              :class="modelValue.includes(option.value) ? 'font-semibold text-highlighted' : 'text-default'"
            >{{ label(option.value) }}</span>
            <span class="shrink-0 font-mono text-xs text-dimmed">{{ option.count }}</span>
          </label>
        </li>
      </ul>

      <button
        v-if="hidden"
        type="button"
        class="mt-1 cursor-pointer px-2 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
        @click="expanded = !expanded"
      >
        {{ expanded ? t('catalog.showLess') : t('catalog.showMore', { n: hidden }) }}
      </button>
    </template>
  </section>
</template>
