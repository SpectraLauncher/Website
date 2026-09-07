<script setup lang="ts">
// What the project still needs, shown to whoever can do something about it.
// This lives in its own component because it belongs in two places at once: at
// the top of the settings area, and on the project page while it is still a
// draft. Buried behind a moderation tab it may as well not exist.
const props = defineProps<{
  project: ChecklistInput
  status: string
  slug: string
  /** Where each item is fixed, so a line is a link rather than a scolding. */
  settingsPath: string
  submitting?: boolean
}>()

const emit = defineEmits<{ submit: [] }>()

const { t } = useI18n()
const localePath = useLocalePath()

const state = computed(() => checklistState(props.project))
const missing = computed(() => missingRequired(state.value))
const ready = computed(() => missing.value.length === 0)

const canSubmit = computed(() => isSubmittable(props.status))
const waiting = computed(() => props.status === 'pending')
const isPrivate = computed(() => props.status === 'private')

// Where each item is edited. A checklist that only tells you what is wrong
// leaves you to go looking for the form.
const WHERE: Record<ChecklistItem, string> = {
  summary: '',
  description: '/description',
  icon: '',
  gallery: '/gallery',
  categories: '/tags',
  license: '/license',
  version: '/versions',
  links: '/links',
  disclosures: '/disclosures',
}

const collapsed = ref(false)
</script>

<template>
  <section
    class="rounded-3xl border p-6"
    :class="ready && !isPrivate
      ? 'border-primary/40 bg-primary/5'
      : 'border-zinc-600/50 bg-black/30 backdrop-blur-sm'"
  >
    <header class="flex flex-wrap items-center gap-2">
      <UIcon
        :name="ready ? 'i-pixelarticons-checkbox-on' : 'i-pixelarticons-list'"
        class="size-5 shrink-0"
        :class="ready ? 'text-primary' : 'text-dimmed'"
      />
      <h2 class="text-base font-semibold">
        {{ waiting ? t('checklist.submitted') : ready ? t('checklist.done') : t('checklist.title') }}
      </h2>
      <UBadge
        v-if="!ready && !waiting"
        size="sm"
        variant="subtle"
        color="warning"
        :label="t('checklist.remaining', missing.length, { n: missing.length })"
      />
      <span class="flex-1"></span>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="collapsed ? 'i-pixelarticons-chevron-down' : 'i-pixelarticons-chevron-up'"
        :aria-label="t('checklist.title')"
        @click="collapsed = !collapsed"
      />
    </header>

    <p class="mt-1 text-sm/relaxed text-muted">
      {{ isPrivate
        ? t('checklist.privateNotice')
        : waiting
          ? t('checklist.submittedHint')
          : ready ? t('checklist.doneHint') : t('checklist.intro') }}
    </p>

    <ul v-if="!collapsed && !isPrivate" class="mt-5 space-y-2.5">
      <li v-for="item in CHECKLIST_ITEMS" :key="item" class="flex gap-2.5">
        <UIcon
          :name="state[item] ? 'i-pixelarticons-check' : 'i-pixelarticons-circle'"
          class="mt-0.5 size-4 shrink-0"
          :class="state[item] ? 'text-primary' : 'text-dimmed'"
        />
        <span class="min-w-0 flex-1">
          <NuxtLink
            :to="localePath(`${settingsPath}${WHERE[item]}`)"
            class="block text-sm transition-colors hover:text-highlighted"
            :class="state[item] ? 'text-dimmed line-through' : 'font-medium'"
          >{{ t(`checklist.items.${item}`) }}</NuxtLink>
          <span v-if="!state[item]" class="mt-0.5 block text-xs/relaxed text-dimmed">
            {{ t(`checklist.items.${item}Hint`) }}
          </span>
        </span>
        <UBadge
          v-if="!state[item] && REQUIRED.includes(item)"
          size="sm"
          variant="subtle"
          color="warning"
          :label="t('checklist.required')"
        />
      </li>
    </ul>

    <div v-if="canSubmit && !isPrivate" class="mt-5 border-t border-white/10 pt-4">
      <UButton
        color="primary"
        class="rounded-xl"
        icon="i-pixelarticons-send"
        :disabled="!ready"
        :loading="props.submitting"
        :label="t('checklist.submit')"
        @click="emit('submit')"
      />
      <p v-if="!ready" class="mt-2 text-xs text-dimmed">{{ t('checklist.blocked') }}</p>
    </div>
  </section>
</template>
