<script setup lang="ts">
// The frame around everything somebody reaches from their own account:
// notifications, projects, collections, organizations, library, analytics,
// revenue, selling, reports and settings. Before this each page built its own
// and none of them could see the others.
//
// A page joins it with definePageMeta({ layout: 'account' }) and renders its own
// UiPageHeader — the layout owns the frame, not the heading.
const { t } = useI18n()
const route = useRoute()
const items = useAccountNav()
const session = useAuthSession()

// Which entry is the current page: the sidebar is a list of routes, so the route
// answers it and no page has to name itself twice.
const current = computed(() => items.value.find(item => item.to === route.path)?.id ?? '')

const user = computed(() => session.value.data?.user as
  { name?: string, username?: string, image?: string } | undefined)

const name = computed(() => user.value?.username || user.value?.name || '—')
const avatar = computed(() => initialsAvatar(name.value))
</script>

<template>
  <UiPageShell width="max-w-6xl">
    <div class="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-start">
      <UiSideNav :model-value="current" :items="items">
        <template #header>
          <div class="flex items-center gap-3 px-1.5 py-1">
            <img
              v-if="user?.image"
              :src="user.image"
              alt=""
              class="size-9 shrink-0 rounded-xl object-cover"
            >
            <span
              v-else
              class="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold"
              :style="`background:hsl(${avatar.hue} 60% 30%)`"
            >{{ avatar.letter }}</span>

            <span class="min-w-0">
              <span class="block truncate text-sm font-bold text-highlighted">{{ name }}</span>
              <span class="block truncate text-xs text-dimmed">{{ t('account.title') }}</span>
            </span>
          </div>
        </template>
      </UiSideNav>

      <div class="min-w-0">
        <slot />
      </div>
    </div>
  </UiPageShell>
</template>
