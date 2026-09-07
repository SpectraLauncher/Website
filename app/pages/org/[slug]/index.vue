<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
const { data, error, org, canManage } = useOrganization(slug)

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
          <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <img v-if="org.logo" :src="org.logo" alt="" class="size-full object-cover">
            <UIcon v-else name="i-pixelarticons-users" class="size-10 text-dimmed" />
          </span>

          <div class="min-w-0 flex-1">
            <h1 class="flex items-center gap-2 text-3xl font-semibold tracking-tight">
              {{ org.name }}
              <UIcon
                v-if="org.verified"
                name="i-pixelarticons-check-double"
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

          <UButton
            v-if="canManage"
            variant="subtle"
            color="neutral"
            class="self-start rounded-xl"
            icon="i-pixelarticons-gear"
            :label="t('catalog.org.manage')"
            :to="localePath(`/org/${org.slug}/settings`)"
          />
        </div>

        <div class="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div class="min-w-0 space-y-6">
            <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
            <article
              v-if="org.description"
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
                      <UIcon v-else name="i-pixelarticons-package" class="size-5 text-dimmed" />
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
                <li v-for="member in data!.members" :key="member.userId">
                  <NuxtLink
                    :to="member.username ? localePath(`/u/${member.username}`) : ''"
                    class="flex items-center gap-3"
                  >
                    <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
                      <UIcon v-else name="i-pixelarticons-user" class="size-4 text-dimmed" />
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm">
                      {{ member.username || member.name || '—' }}
                    </span>
                    <UBadge variant="subtle" size="sm" :label="t(`catalog.org.roles.${member.role}`)" />
                  </NuxtLink>
                </li>
              </ul>
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
                    <UIcon name="i-pixelarticons-external-link" class="size-3.5" />
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
