<script setup lang="ts">
// The address field, with the part nobody types shown rather than explained.
// Reading "usespectra.app/mod/" in front of the box is what stops somebody
// pasting a whole URL into it.
//
// The prefix is a sibling rather than UInput's leading slot: that slot is
// positioned over the field and sized for an icon, so a word-length prefix
// would sit on top of what is being typed.
const props = defineProps<{
  prefix: string
  label: string
  maxlength?: number
}>()

const slug = defineModel<string>({ required: true })

const { t } = useI18n()

const touched = ref(false)

// Once it has been edited by hand the field stops following the name.
function follow(source: string) {
  if (!touched.value) slug.value = normalizeSlug(source)
}

defineExpose({ follow })

const problem = computed(() => (slug.value ? slugProblem(slug.value) : null))
</script>

<template>
  <UFormField
    :label="props.label"
    :error="problem ? t(`catalog.slugProblem.${problem}`) : undefined"
  >
    <div
      class="flex items-stretch overflow-hidden rounded-xl bg-black/30 ring ring-inset ring-zinc-600/50 transition-colors focus-within:ring-zinc-400"
      :class="problem ? 'ring-error' : ''"
    >
      <span
        class="flex select-none items-center whitespace-nowrap border-r border-zinc-600/50 bg-white/[0.03] px-3 font-mono text-xs text-dimmed"
      >{{ props.prefix }}</span>

      <input
        v-model="slug"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :maxlength="props.maxlength ?? 64"
        class="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-highlighted outline-none placeholder:text-dimmed"
        @input="touched = true"
      >
    </div>
  </UFormField>
</template>
