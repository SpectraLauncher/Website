<script setup lang="ts">
interface Report {
  id: string
  reason: string
  itemType: string
  body: string
  status: string
  note: string
  created: number
  target: { label: string, path: string } | null
}

interface Message {
  id: string
  body: string
  staff: boolean
  created: number
  author: { name: string | null, username: string | null } | null
}

definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const session = useAuthSession()

useHead({ title: () => t('reports.mine') })
useSeoMeta({ robots: 'noindex' })

watchEffect(() => {
  if (import.meta.client && !session.value.isPending && !session.value.data) {
    navigateTo(localePath('/login'))
  }
})

const reports = ref<Report[]>([])
const loaded = ref(false)
const open = ref<string | null>(null)
const messages = ref<Message[]>([])
const draft = ref('')
const busy = ref('')
const error = ref('')

async function load() {
  try {
    const res = await $fetch<{ reports: Report[] }>('/api/catalog/reports')
    reports.value = res.reports
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    loaded.value = true
  }
}

onMounted(load)

async function openThread(report: Report) {
  if (open.value === report.id) {
    open.value = null
    return
  }

  open.value = report.id
  messages.value = []
  const res = await $fetch<{ messages: Message[] }>(`/api/catalog/reports/${report.id}/thread`)
  messages.value = res.messages
}

async function reply(report: Report) {
  if (!draft.value.trim()) return

  busy.value = report.id
  error.value = ''
  try {
    await $fetch(`/api/catalog/reports/${report.id}/thread`, {
      method: 'POST',
      body: { body: draft.value },
    })
    draft.value = ''
    const res = await $fetch<{ messages: Message[] }>(`/api/catalog/reports/${report.id}/thread`)
    messages.value = res.messages
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'neutral'> = {
  open: 'warning',
  resolved: 'success',
  dismissed: 'neutral',
}

const when = (ms: number) => new Date(ms).toLocaleString(locale.value)
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="mb-2 text-2xl font-semibold tracking-tight">{{ t('reports.mine') }}</h1>
        <p class="mb-8 text-sm text-muted">{{ t('reports.mineHint') }}</p>

        <UAlert v-if="error" color="error" variant="subtle" class="mb-4 rounded-2xl" :description="error" />

        <ul v-if="reports.length" class="space-y-3">
          <li
            v-for="report in reports"
            :key="report.id"
            class="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <UBadge size="sm" variant="subtle" :label="t(`reports.reasons.${report.reason}`)" />
              <UBadge
                size="sm"
                variant="subtle"
                :color="STATUS_COLOR[report.status] ?? 'neutral'"
                :label="t(`reports.statuses.${report.status}`)"
              />
              <NuxtLink
                v-if="report.target"
                :to="localePath(report.target.path)"
                class="min-w-0 flex-1 truncate text-primary hover:underline"
              >
                {{ report.target.label }}
              </NuxtLink>
              <span v-else class="min-w-0 flex-1 truncate text-dimmed">{{ t('reports.gone') }}</span>
              <span class="text-xs text-dimmed">{{ when(report.created) }}</span>
            </div>

            <p class="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{{ report.body }}</p>

            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              class="mt-2"
              :icon="open === report.id ? 'i-lucide-chevron-up' : 'i-lucide-message-square'"
              :label="t('reports.conversation')"
              @click="openThread(report)"
            />

            <div v-if="open === report.id" class="mt-3 border-t border-white/10 pt-3">
              <ul v-if="messages.length" class="mb-3 space-y-2">
                <li
                  v-for="message in messages"
                  :key="message.id"
                  class="rounded-xl border border-white/10 p-3"
                  :class="message.staff ? 'bg-white/5' : ''"
                >
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span class="font-medium">
                      {{ message.author?.name || message.author?.username || t('catalog.deletedUser') }}
                    </span>
                    <UBadge v-if="message.staff" size="sm" variant="subtle" :label="t('catalog.staff')" />
                    <span class="text-dimmed">{{ when(message.created) }}</span>
                  </div>
                  <p class="mt-1.5 whitespace-pre-wrap break-words text-sm text-muted">{{ message.body }}</p>
                </li>
              </ul>

              <p v-else class="mb-3 text-xs text-dimmed">{{ t('reports.noMessages') }}</p>

              <UTextarea
                v-model="draft"
                :rows="2"
                :maxlength="2000"
                class="w-full"
                :placeholder="t('reports.replyPlaceholder')"
              />
              <div class="mt-2 flex justify-end">
                <UButton
                  size="xs"
                  color="neutral"
                  :disabled="!draft.trim()"
                  :loading="busy === report.id"
                  :label="t('catalog.reply')"
                  @click="reply(report)"
                />
              </div>
            </div>
          </li>
        </ul>

        <p v-else-if="loaded" class="rounded-2xl border border-white/10 p-10 text-center text-sm text-dimmed">
          {{ t('reports.noneMine') }}
        </p>
      </section>
    </div>
  </div>
</template>
