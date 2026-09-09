<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface QueueItem {
  id: string
  kind: 'partner' | 'organization'
  status: string
  body: string
  links: Record<string, string>
  created: number
  subject: { kind: string, slug: string | null, name: string | null, image: string | null }
}

const busy = ref('')
const problem = ref('')
const notes = reactive<Record<string, string>>({})

const { data, refresh } = await useFetch<{ requests: QueueItem[] }>('/api/admin/verification')

async function decide(item: QueueItem, approve: boolean) {
  busy.value = item.id
  problem.value = ''
  try {
    await $fetch(`/api/admin/verification/${item.id}`, {
      method: 'POST',
      body: { approve, note: notes[item.id] ?? '' },
    })
    delete notes[item.id]
    await refresh()
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('verification.failed')
  } finally { busy.value = '' }
}

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(ms))

useSeoMeta({ title: () => t('verification.queueTitle'), robots: 'noindex' })
</script>

<template>
  <div>
    <SiteNavbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-4xl px-4 pb-24 pt-40">
        <div class="mb-6 flex flex-wrap items-center gap-4">
          <span class="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <UIcon name="i-pixelarticons-check-double" class="size-6 text-primary" />
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="text-2xl font-semibold tracking-tight">{{ t('verification.queueTitle') }}</h1>
            <p class="text-sm text-muted">
              {{ t('verification.queueCount', { n: data?.requests.length ?? 0 }) }}
            </p>
          </div>
          <UButton
            variant="ghost"
            color="neutral"
            class="rounded-xl"
            icon="i-pixelarticons-arrow-left"
            :label="t('catalog.admin.backToPanel')"
            :to="localePath('/admin')"
          />
        </div>

        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          class="mb-4 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="problem"
        />

        <ul v-if="data?.requests.length" class="space-y-4">
          <li
            v-for="item in data.requests"
            :key="item.id"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <div class="flex flex-wrap items-center gap-3">
              <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <img v-if="item.subject.image" :src="item.subject.image" alt="" class="size-full object-cover">
                <UIcon
                  v-else
                  :name="item.kind === 'organization' ? 'i-pixelarticons-users' : 'i-pixelarticons-user'"
                  class="size-5 text-dimmed"
                />
              </span>

              <div class="min-w-0 flex-1">
                <NuxtLink
                  v-if="item.subject.slug"
                  :to="localePath(item.kind === 'organization'
                    ? `/org/${item.subject.slug}`
                    : `/u/${item.subject.slug}`)"
                  class="font-medium hover:underline"
                >{{ item.subject.name || item.subject.slug }}</NuxtLink>
                <span v-else class="font-medium text-dimmed">—</span>
                <p class="text-xs text-dimmed">
                  {{ t(`verification.kinds.${item.kind}`) }} · {{ when(item.created) }}
                </p>
              </div>
            </div>

            <p class="mt-4 whitespace-pre-line text-sm text-muted">{{ item.body }}</p>

            <ul v-if="Object.keys(item.links).length" class="mt-3 space-y-1 text-sm">
              <li v-for="(url, name) in item.links" :key="name">
                <a
                  :href="url"
                  target="_blank"
                  rel="nofollow ugc noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <UIcon name="i-pixelarticons-external-link" class="size-3.5" />
                  {{ name }}
                </a>
              </li>
            </ul>

            <UInput
              v-model="notes[item.id]"
              class="mt-4 w-full"
              :placeholder="t('verification.notePlaceholder')"
            />

            <div class="mt-3 flex gap-2">
              <UButton
                color="success"
                :loading="busy === item.id"
                :label="t('verification.approve')"
                @click="decide(item, true)"
              />
              <UButton
                variant="subtle"
                color="error"
                :loading="busy === item.id"
                :disabled="!notes[item.id]?.trim()"
                :label="t('verification.reject')"
                @click="decide(item, false)"
              />
            </div>
            <p class="mt-2 text-xs text-dimmed">{{ t('verification.rejectNeedsNote') }}</p>
          </li>
        </ul>

        <div v-else class="rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm">
          <UIcon name="i-pixelarticons-inbox" class="mx-auto size-10 text-dimmed" />
          <p class="mt-3 text-sm text-muted">{{ t('verification.queueEmpty') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
