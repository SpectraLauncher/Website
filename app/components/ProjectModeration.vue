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

const props = defineProps<{ slug: string }>()

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
