<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Member {
  userId: string
  role: string
  username: string | null
  name: string | null
  image: string | null
  joined: number
}

interface OrgProject {
  id: string
  slug: string
  type: string
  path: string
  title: string
  summary: string
  icon: string | null
  status: string
  downloads: number
  updated: number
}

interface Org {
  id: string
  slug: string
  name: string
  logo: string | null
  summary: string
  description: string
  links: Record<string, string>
  verified: boolean
  created: number
}

const slug = computed(() => String(route.params.slug ?? ''))

const { data, error, refresh } = await useFetch<{
  org: Org
  members: Member[]
  projects: OrgProject[]
  role: string | null
}>(() => `/api/org/${encodeURIComponent(slug.value)}`)

const org = computed(() => data.value?.org ?? null)
const canEdit = computed(() => data.value?.role === 'owner' || data.value?.role === 'admin')

const editing = ref(false)
const busy = ref('')
const problem = ref('')

const form = reactive({ name: '', summary: '', description: '' })

function startEditing() {
  if (!org.value) return
  form.name = org.value.name
  form.summary = org.value.summary
  form.description = org.value.description
  editing.value = true
}

async function save() {
  busy.value = 'save'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}`, { method: 'PATCH', body: form })
    editing.value = false
    await refresh()
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
  } finally { busy.value = '' }
}

async function uploadLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  busy.value = 'logo'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/logo`, {
      method: 'POST',
      body: await file.arrayBuffer(),
      headers: { 'content-type': file.type },
    })
    await refresh()
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
  } finally { busy.value = '' }
}

const invitee = ref('')
const invited = ref(false)

async function invite() {
  if (!invitee.value.trim()) return
  busy.value = 'invite'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/invite`, {
      method: 'POST',
      body: { username: invitee.value.trim() },
    })
    invitee.value = ''
    invited.value = true
    setTimeout(() => (invited.value = false), 5000)
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
  } finally { busy.value = '' }
}

const body = computed(() => renderMarkdown(org.value?.description ?? ''))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

useSeoMeta({
  title: () => org.value?.name ?? t('catalog.notFound'),
  description: () => org.value?.summary || markdownExcerpt(org.value?.description ?? ''),
  ogTitle: () => org.value?.name ?? '',
  robots: () => (org.value ? 'index, follow' : 'noindex'),
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section v-if="org" class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
        <div class="flex flex-wrap gap-6">
          <div class="relative">
            <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <img v-if="org.logo" :src="org.logo" alt="" class="size-full object-cover">
              <UIcon v-else name="i-lucide-users" class="size-10 text-dimmed" />
            </span>
            <label
              v-if="canEdit"
              class="absolute -bottom-2 -right-2 grid size-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-black/70 backdrop-blur-sm transition-colors hover:bg-black/90"
            >
              <UIcon name="i-lucide-camera" class="size-4" />
              <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadLogo">
            </label>
          </div>

          <div class="min-w-0 flex-1">
            <h1 class="flex items-center gap-2 text-3xl font-semibold tracking-tight">
              {{ org.name }}
              <UIcon
                v-if="org.verified"
                name="i-lucide-badge-check"
                class="size-6 shrink-0 text-primary"
                :title="t('verification.verifiedOrg')"
              />
            </h1>
            <p v-if="org.summary" class="mt-2 max-w-2xl text-base/relaxed text-muted">
              {{ org.summary }}
            </p>
            <p class="mt-3 text-sm text-dimmed">
              {{ t('catalog.org.memberCount', { n: data!.members.length }) }}
              ·
              {{ t('catalog.org.projectCount', { n: data!.projects.length }) }}
            </p>
          </div>

          <div v-if="canEdit && !editing" class="flex gap-2 self-start">
            <UButton
              variant="subtle"
              color="neutral"
              class="rounded-xl"
              icon="i-lucide-pencil"
              :label="t('catalog.org.edit')"
              @click="startEditing"
            />
            <UButton
              v-if="!org.verified && data?.role === 'owner'"
              variant="ghost"
              color="neutral"
              class="rounded-xl"
              icon="i-lucide-badge-check"
              :label="t('verification.apply')"
              :to="localePath('/verification')"
            />
          </div>
        </div>

        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          class="mt-4 rounded-2xl"
          icon="i-lucide-triangle-alert"
          :description="problem"
        />

        <div class="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div class="min-w-0 space-y-6">
            <div
              v-if="editing"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <h2 class="text-lg font-semibold">{{ t('catalog.org.edit') }}</h2>
              <div class="mt-4 space-y-3">
                <UInput v-model="form.name" :placeholder="t('catalog.org.name')" />
                <UInput v-model="form.summary" :placeholder="t('catalog.org.summary')" />
                <UTextarea
                  v-model="form.description"
                  :rows="14"
                  :placeholder="t('catalog.org.readmePlaceholder')"
                  class="w-full font-mono text-sm"
                />
              </div>
              <div class="mt-4 flex gap-2">
                <UButton :label="t('catalog.org.save')" :loading="busy === 'save'" @click="save" />
                <UButton
                  variant="ghost"
                  color="neutral"
                  :label="t('catalog.org.cancel')"
                  @click="editing = false"
                />
              </div>
            </div>

            <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
            <article
              v-else-if="org.description"
              class="prose prose-invert max-w-none rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm prose-a:text-primary"
              v-html="body"
            />

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="text-lg font-semibold">{{ t('catalog.org.projects') }}</h2>

              <ul v-if="data!.projects.length" class="mt-4 grid gap-3 sm:grid-cols-2">
                <li v-for="project in data!.projects" :key="project.id">
                  <NuxtLink
                    :to="localePath(project.path)"
                    class="flex h-full gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-zinc-500"
                  >
                    <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
                      <UIcon v-else name="i-lucide-package" class="size-5 text-dimmed" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ project.title }}</span>
                        <UBadge
                          v-if="project.status !== 'published'"
                          variant="subtle"
                          size="sm"
                          :label="t('catalog.org.draft')"
                        />
                      </span>
                      <span class="mt-0.5 line-clamp-2 block text-xs text-muted">{{ project.summary }}</span>
                      <span class="mt-1 block text-xs text-dimmed">
                        {{ t('catalog.downloads', { n: count(project.downloads) }) }}
                      </span>
                    </span>
                  </NuxtLink>
                </li>
              </ul>

              <p v-else class="mt-4 text-sm text-dimmed">{{ t('catalog.org.noProjects') }}</p>
            </div>
          </div>

          <aside class="space-y-6">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="text-lg font-semibold">{{ t('catalog.org.members') }}</h2>
              <ul class="mt-4 space-y-3">
                <li v-for="member in data!.members" :key="member.userId" class="flex items-center gap-3">
                  <NuxtLink
                    :to="member.username ? localePath(`/u/${member.username}`) : ''"
                    class="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
                      <UIcon v-else name="i-lucide-user" class="size-4 text-dimmed" />
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm">
                      {{ member.username || member.name || '—' }}
                    </span>
                  </NuxtLink>
                  <UBadge variant="subtle" size="sm" :label="member.role" />
                </li>
              </ul>

              <div v-if="canEdit" class="mt-5 border-t border-white/10 pt-4">
                <p class="text-xs text-dimmed">{{ t('catalog.org.inviteHint') }}</p>
                <div class="mt-2 flex gap-2">
                  <UInput
                    v-model="invitee"
                    size="sm"
                    class="flex-1"
                    :placeholder="t('catalog.org.username')"
                    @keyup.enter="invite"
                  />
                  <UButton
                    size="sm"
                    icon="i-lucide-user-plus"
                    :loading="busy === 'invite'"
                    @click="invite"
                  />
                </div>
                <p v-if="invited" class="mt-2 text-xs text-success">
                  {{ t('catalog.org.inviteSent') }}
                </p>
              </div>
            </div>

            <div
              v-if="Object.keys(org.links).length"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <h2 class="text-lg font-semibold">{{ t('catalog.links') }}</h2>
              <ul class="mt-4 space-y-2 text-sm">
                <li v-for="(url, name) in org.links" :key="name">
                  <a
                    :href="url"
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <UIcon name="i-lucide-external-link" class="size-3.5" />
                    {{ name }}
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section v-else-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
      </section>
    </div>
  </div>
</template>
