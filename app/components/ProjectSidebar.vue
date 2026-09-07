<script setup lang="ts">
import type { CatalogProjectData } from '~/components/CatalogProject.vue'

// The five cards Modrinth puts beside a project, in the same order and for the
// same reason: compatibility is the first question, links are the second, and
// the rest is what somebody checks before trusting a download.
const props = defineProps<{
  project: CatalogProjectData
  members?: Array<{ userId: string, username: string | null, name: string | null, image: string | null }>
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

const latest = computed(() => props.project.versions[0] ?? null)
const packFormat = computed(() => latest.value?.meta?.packFormat)

const hasCompatibility = computed(() =>
  props.project.gameVersions.length || props.project.loaders.length
  || props.project.environment?.length || packFormat.value)

const links = computed(() => Object.entries(props.project.links ?? {}).filter(([, url]) => url))

const owner = computed(() => props.project.owner)
</script>

<template>
  <aside class="space-y-4">
    <div
      v-if="hasCompatibility"
      class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
    >
      <h2 class="mb-3 text-sm font-semibold">{{ t('catalog.compatibility') }}</h2>

      <div v-if="project.gameVersions.length" class="mb-3">
        <p class="mb-1.5 text-xs text-dimmed">{{ t('catalog.gameVersions') }}</p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="version in project.gameVersions"
            :key="version"
            size="sm"
            variant="subtle"
            color="neutral"
            class="font-mono"
            :label="version"
          />
        </div>
      </div>

      <div v-if="project.loaders.length" class="mb-3">
        <p class="mb-1.5 text-xs text-dimmed">{{ t('catalog.loaders') }}</p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="loader in project.loaders"
            :key="loader"
            size="sm"
            variant="subtle"
            color="neutral"
            :label="loader"
          />
        </div>
      </div>

      <div v-if="project.environment?.length" class="mb-3">
        <p class="mb-1.5 text-xs text-dimmed">{{ t('catalog.environment') }}</p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="side in project.environment"
            :key="side"
            size="sm"
            variant="subtle"
            color="neutral"
            :label="t(`catalog.environments.${side}`)"
          />
        </div>
      </div>

      <div v-if="packFormat" class="flex justify-between gap-4 text-sm">
        <span class="text-dimmed">pack_format</span>
        <span class="font-mono">{{ packFormat }}</span>
      </div>
    </div>

    <div v-if="links.length" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
      <h2 class="mb-3 text-sm font-semibold">{{ t('catalog.links') }}</h2>
      <ul class="space-y-2 text-sm">
        <li v-for="[name, url] in links" :key="name">
          <a
            :href="url"
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <UIcon name="i-pixelarticons-external-link" class="size-3.5 shrink-0" />
            {{ t(`links.${name}`) }}
          </a>
        </li>
      </ul>
    </div>

    <div
      v-if="project.categories.length"
      class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
    >
      <h2 class="mb-3 text-sm font-semibold">{{ t('catalog.categories') }}</h2>
      <div class="flex flex-wrap gap-1">
        <UBadge
          v-for="category in project.categories"
          :key="category"
          size="sm"
          variant="subtle"
          color="neutral"
          :label="t(`catalog.categoryNames.${category}`)"
        />
      </div>
    </div>

    <div
      v-if="owner || members?.length"
      class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
    >
      <h2 class="mb-3 text-sm font-semibold">{{ t('catalog.creators') }}</h2>
      <ul class="space-y-2">
        <li v-if="owner?.slug">
          <NuxtLink
            :to="localePath(owner.kind === 'organization' ? `/org/${owner.slug}` : `/u/${owner.slug}`)"
            class="flex items-center gap-2.5 transition-colors hover:text-highlighted"
          >
            <span class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
              <img v-if="owner.image" :src="owner.image" alt="" class="size-full object-cover">
              <UIcon
                v-else
                :name="owner.kind === 'organization' ? 'i-pixelarticons-users' : 'i-pixelarticons-user'"
                class="size-3.5 text-dimmed"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ owner.name || owner.slug }}</span>
              <span class="block text-xs text-dimmed">
                {{ owner.kind === 'organization' ? t('catalog.organization') : t('catalog.owner') }}
              </span>
            </span>
          </NuxtLink>
        </li>

        <li v-for="member in members ?? []" :key="member.userId">
          <NuxtLink
            :to="member.username ? localePath(`/u/${member.username}`) : ''"
            class="flex items-center gap-2.5 transition-colors hover:text-highlighted"
          >
            <span class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
              <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
              <UIcon v-else name="i-pixelarticons-user" class="size-3.5 text-dimmed" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm">
              {{ member.username || member.name || '—' }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>

    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
      <h2 class="mb-3 text-sm font-semibold">{{ t('catalog.details') }}</h2>
      <dl class="space-y-2 text-sm">
        <div v-if="project.license" class="flex justify-between gap-4">
          <dt class="shrink-0 text-dimmed">{{ t('catalog.license') }}</dt>
          <dd class="text-right">
            <a
              v-if="project.licenseUrl"
              :href="project.licenseUrl"
              target="_blank"
              rel="nofollow ugc noopener noreferrer"
              class="text-primary hover:underline"
            >{{ project.license }}</a>
            <template v-else>{{ project.license }}</template>
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="shrink-0 text-dimmed">{{ t('catalog.downloadsLabel') }}</dt>
          <dd>{{ count(project.downloads) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="shrink-0 text-dimmed">{{ t('catalog.followers') }}</dt>
          <dd>{{ count(project.follows) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="shrink-0 text-dimmed">{{ t('catalog.created') }}</dt>
          <dd>{{ when(project.created) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="shrink-0 text-dimmed">{{ t('catalog.updated') }}</dt>
          <dd>{{ when(project.updated) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="shrink-0 text-dimmed">{{ t('catalog.projectId') }}</dt>
          <dd class="font-mono text-xs">{{ project.id }}</dd>
        </div>
      </dl>
    </div>
  </aside>
</template>
