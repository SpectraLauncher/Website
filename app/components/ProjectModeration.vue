<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'

interface ThreadAuthor {
  id: string
  name: string | null
  username: string | null
  image: string | null
}

interface ThreadMessage {
  id: string
  body: string
  staff: boolean
  status: string | null
  created: number
  author: ThreadAuthor | null
}

const props = defineProps<{
  slug: string
  project?: ChecklistInput
}>()

const { t, locale } = useI18n()
const session = useAuthSession()
const isStaff = computed(() => (session.value.data?.user as { role?: string })?.role === 'admin')

const messages = ref<ThreadMessage[]>([])
const status = ref('')
const visible = ref(false)
const draft = ref('')
const busy = ref(false)
const error = ref('')

// A 404 here is the normal answer for anyone who is not the author or staff,
// so the whole panel simply stays hidden rather than showing a failure.
async function load() {
  try {
    const res = await $fetch<{ status: string, messages: ThreadMessage[] }>(
      `/api/catalog/project/${props.slug}/thread`)
    messages.value = res.messages
    status.value = res.status
    visible.value = true
  }
  catch {
    visible.value = false
  }
}

onMounted(load)

async function send() {
  const body = draft.value.trim()
  if (!body) return

  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/catalog/project/${props.slug}/thread`, { method: 'POST', body: { body } })
    draft.value = ''
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = false
  }
}

const STATUS_COLOR: Record<string, BadgeProps['color']> = {
  published: 'success',
  rejected: 'error',
  removed: 'error',
  draft: 'neutral',
  unlisted: 'warning',
  archived: 'neutral',
}

const when = (ms: number) => new Date(ms).toLocaleString(locale.value)
const needsAppeal = computed(() => status.value === 'rejected' || status.value === 'removed')
const canSubmit = computed(() => isSubmittable(status.value))

const submitting = ref(false)

// What the project still needs. Shown while it is the author's to change, and
// not once it is with a moderator — a list of chores under a decision that has
// already been asked for reads as if something went wrong.
const checklist = computed(() => checklistState(props.project ?? {}))
const missing = computed(() => missingRequired(checklist.value))
const ready = computed(() => missing.value.length === 0)

const showChecklist = computed(() =>
  Boolean(props.project) && !isStaff.value
  && (canSubmit.value || status.value === 'private'))

async function submit() {
  submitting.value = true
  error.value = ''
  try {
    await $fetch(`/api/catalog/project/${props.slug}/submit`, {
      method: 'POST',
      body: { body: draft.value.trim() || undefined },
    })
    draft.value = ''
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <section
    v-if="visible && (messages.length || needsAppeal || canSubmit || status === 'pending' || isStaff)"
    class="mt-10 rounded-3xl border p-6"
    :class="needsAppeal ? 'border-error/40 bg-error/5' : 'border-white/10 bg-white/[0.02]'"
  >
    <header class="mb-4 flex flex-wrap items-center gap-2">
      <UIcon name="i-pixelarticons-scale" class="size-5 text-muted" />
      <h2 class="text-lg font-semibold">{{ t('catalog.moderation') }}</h2>
      <UBadge
        :color="STATUS_COLOR[status] ?? 'neutral'"
        variant="subtle"
        :label="t(`catalog.status.${status}`)"
      />
    </header>

    <div v-if="status === 'private'" class="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p class="text-sm/relaxed text-muted">{{ t('checklist.privateNotice') }}</p>
    </div>

    <div v-if="showChecklist" class="mb-5 rounded-2xl border border-white/10 bg-black/20 p-5">
      <header class="mb-1 flex flex-wrap items-center gap-2">
        <UIcon
          :name="ready ? 'i-pixelarticons-checkbox-on' : 'i-pixelarticons-list'"
          class="size-4"
          :class="ready ? 'text-primary' : 'text-dimmed'"
        />
        <h3 class="text-sm font-semibold">
          {{ ready ? t('checklist.done') : t('checklist.title') }}
        </h3>
        <UBadge
          v-if="!ready"
          size="sm"
          variant="subtle"
          color="warning"
          :label="t('checklist.remaining', missing.length, { n: missing.length })"
        />
      </header>

      <p class="mb-4 text-xs/relaxed text-dimmed">
        {{ ready ? t('checklist.doneHint') : t('checklist.intro') }}
      </p>

      <ul class="space-y-2.5">
        <li
          v-for="item in CHECKLIST_ITEMS"
          :key="item"
          class="flex gap-2.5"
        >
          <UIcon
            :name="checklist[item] ? 'i-pixelarticons-check' : 'i-pixelarticons-circle'"
            class="mt-0.5 size-4 shrink-0"
            :class="checklist[item] ? 'text-primary' : 'text-dimmed'"
          />
          <span class="min-w-0">
            <span
              class="block text-sm"
              :class="checklist[item] ? 'text-dimmed line-through' : 'font-medium'"
            >{{ t(`checklist.items.${item}`) }}</span>
            <span v-if="!checklist[item]" class="mt-0.5 block text-xs/relaxed text-dimmed">
              {{ t(`checklist.items.${item}Hint`) }}
            </span>
          </span>
        </li>
      </ul>
    </div>

    <p v-if="needsAppeal" class="mb-4 text-sm text-muted">{{ t('catalog.appealHint') }}</p>
    <p v-else-if="status === 'pending'" class="mb-4 text-sm text-muted">{{ t('catalog.pendingHint') }}</p>
    <p v-else-if="canSubmit" class="mb-4 text-sm text-muted">{{ t('catalog.submitHint') }}</p>

    <ul v-if="messages.length" class="mb-5 space-y-3">
      <li
        v-for="message in messages"
        :key="message.id"
        class="rounded-2xl border border-white/10 p-4"
        :class="message.staff ? 'bg-white/5' : 'bg-transparent'"
      >
        <header class="flex flex-wrap items-center gap-2 text-sm">
          <span class="font-medium">
            {{ message.author?.name || message.author?.username || t('catalog.deletedUser') }}
          </span>
          <UBadge v-if="message.staff" size="sm" variant="subtle" :label="t('catalog.staff')" />
          <UBadge
            v-if="message.status"
            size="sm"
            :color="STATUS_COLOR[message.status] ?? 'neutral'"
            variant="subtle"
            :label="t(`catalog.status.${message.status}`)"
          />
          <span class="text-xs text-dimmed">{{ when(message.created) }}</span>
        </header>
        <p class="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{{ message.body }}</p>
      </li>
    </ul>

    <UAlert v-if="error" color="error" variant="subtle" :description="error" class="mb-3" />

    <UTextarea
      v-model="draft"
      :rows="3"
      :maxlength="4000"
      :placeholder="isStaff ? t('catalog.staffReplyPlaceholder') : t('catalog.appealPlaceholder')"
      class="w-full"
    />
    <div class="mt-2 flex flex-wrap justify-end gap-2">
      <UButton
        v-if="canSubmit && !isStaff"
        size="sm"
        color="primary"
        class="rounded-xl"
        icon="i-pixelarticons-send"
        :loading="submitting"
        :label="t('catalog.submit')"
        @click="submit"
      />
      <UButton
        size="sm"
        color="neutral"
        class="rounded-xl"
        :disabled="!draft.trim()"
        :loading="busy"
        :label="isStaff ? t('catalog.reply') : t('catalog.appeal')"
        @click="send"
      />
    </div>
  </section>
</template>
