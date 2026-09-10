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
  <UiPageShell>
    <template v-if="org">
      <UiPanel class="mb-5 flex flex-wrap items-start gap-6 p-5 sm:p-6">
        <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-raised-line bg-raised">
          <img v-if="org.logo" :src="org.logo" alt="" class="size-full object-cover">
          <UIcon v-else name="i-pixelarticons-users" class="size-10 text-dimmed" />
        </span>

        <div class="min-w-0 flex-1 basis-72">
          <h1 class="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-highlighted">
            {{ org.name }}
            <UIcon
              v-if="org.verified"
              name="i-pixelarticons-check-double"
              class="size-6 shrink-0 text-primary"
              :title="t('verification.verifiedOrg')"
            />
          </h1>
          <p v-if="org.summary" class="mt-2.5 max-w-2xl text-pretty text-muted">{{ org.summary }}</p>
        </div>

        <div class="flex flex-wrap items-end gap-6 self-stretch">
          <UiStat
            :label="t('catalog.org.members')"
            :value="count(data!.members.length)"
          />
          <UiStat
            :label="t('catalog.org.projects')"
            :value="count(data!.projects.length)"
          />

          <UButton
            v-if="canManage"
            variant="subtle"
            color="neutral"
            size="lg"
            icon="i-pixelarticons-gear"
            :label="t('catalog.org.manage')"
            :to="localePath(`/org/${org.slug}/settings`)"
          />
        </div>
      </UiPanel>

      <div class="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div class="flex min-w-0 flex-col gap-5">
          <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
          <UiPanel v-if="org.description">
            <article class="prose prose-invert max-w-none p-5 sm:p-6 prose-a:text-primary" v-html="body" />
          </UiPanel>

          <UiPanel class="p-5 sm:p-6">
            <h2 class="text-base font-bold text-highlighted">{{ t('catalog.org.projects') }}</h2>

            <ul v-if="data!.projects.length" class="mt-4 grid gap-3 sm:grid-cols-2">
              <li v-for="project in data!.projects" :key="project.id">
                <NuxtLink
                  :to="localePath(project.path)"
                  class="flex h-full gap-3 rounded-xl border border-raised-line bg-raised p-4 transition-colors hover:border-zinc-600"
                >
                  <CatalogThumb :src="project.icon" fallback="i-pixelarticons-package" class="size-12" />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-2">
                      <span class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">{{ project.title }}</span>
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
          </UiPanel>
        </div>

        <aside class="flex min-w-0 flex-col gap-4">
          <UiPanel class="p-5">
            <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('catalog.org.members') }}</h2>
            <ul class="space-y-2.5">
              <li v-for="member in data!.members" :key="member.userId">
                <NuxtLink
                  :to="member.username ? localePath(`/u/${member.username}`) : ''"
                  class="flex items-center gap-3"
                >
                  <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-raised-line bg-raised">
                    <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
                    <UIcon v-else name="i-pixelarticons-user" class="size-4 text-dimmed" />
                  </span>
                  <span class="min-w-0 flex-1 truncate text-sm text-default">
                    {{ member.username || member.name || '—' }}
                  </span>
                  <UBadge variant="subtle" size="sm" :label="t(`catalog.org.roles.${member.role}`)" />
                </NuxtLink>
              </li>
            </ul>
          </UiPanel>

          <UiPanel v-if="Object.keys(org.links).length" class="p-5">
            <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('catalog.links') }}</h2>
            <ul class="space-y-2 text-sm">
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
          </UiPanel>
        </aside>
      </div>
    </template>

    <UiPanel v-else-if="error" class="mx-auto max-w-lg p-12 text-center">
      <UIcon name="i-pixelarticons-users" class="mx-auto size-10 text-dimmed" />
      <h1 class="mt-3 text-xl font-bold text-highlighted">{{ t('catalog.notFound') }}</h1>
    </UiPanel>
  </UiPageShell>
</template>
