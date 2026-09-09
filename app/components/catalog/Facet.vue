<script setup lang="ts">
const props = defineProps<{
  title: string
  options: Array<{ value: string, count: number }>
  modelValue: string[]
  labelKey?: string
  collapseAfter?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const { t, te } = useI18n()

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
  <section v-if="options.length">
    <h3 class="text-xs font-semibold uppercase tracking-wider text-dimmed">{{ title }}</h3>

    <ul class="mt-2 space-y-0.5">
      <li v-for="option in visible" :key="option.value">
        <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
          <input
            type="checkbox"
            class="size-3.5 shrink-0 accent-primary"
            :checked="modelValue.includes(option.value)"
            @change="toggle(option.value)"
          >
          <span class="min-w-0 flex-1 truncate text-sm">{{ label(option.value) }}</span>
          <span class="shrink-0 font-mono text-xs text-dimmed">{{ option.count }}</span>
        </label>
      </li>
    </ul>

    <button
      v-if="hidden"
      class="mt-1 px-2 text-xs text-primary transition-opacity hover:opacity-80"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('catalog.showLess') : t('catalog.showMore', { n: hidden }) }}
    </button>
  </section>
</template>
