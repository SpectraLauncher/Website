<script setup lang="ts">
// The frame around every page of the panel.
//
// Before this only /admin drew the sidebar, because the registry lived inside
// that page — so opening the catalog, the audit log or the article editor lost
// the navigation entirely and the way back was the browser's back button.
//
// A page joins it with definePageMeta({ layout: 'admin' }) and renders its own
// heading; the layout owns the frame, not the content.
const route = useRoute()
const localePath = useLocalePath()

const { data: staff } = await useFetch<{ username: string | null, role: string | null }>(
  '/api/admin/session')

const role = computed(() => staff.value?.role ?? null)

const items = computed<SideNavItem[]>(() => ADMIN_NAV
  .filter(entry => atLeast({ role: role.value }, entry.need))
  .map(entry => ({
    id: entry.id,
    icon: entry.icon,
    label: entry.label,
    group: entry.group,
    // A section without an address is a tab on /admin itself.
    to: localePath(entry.to ?? `/admin?tab=${entry.id}`),
  })))

const current = computed(() => adminNavCurrent(route.path, route.query))

const ROLE_LABEL: Record<string, string> = {
  owner: 'właściciel',
  admin: 'admin',
  moderator: 'moderator',
}
</script>

<template>
  <!-- Wider than the rest of the site on purpose: the panel is tables and an
       editor, and at max-w-7xl the sidebar plus a list left about 300px to write
       an article in. -->
  <UiPageShell width="max-w-[1680px]">
    <div class="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-start">
      <UiSideNav :model-value="current" :items="items">
        <template #header>
          <NuxtLink
            :to="localePath('/admin')"
            class="flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-raised text-primary">
              <UIcon name="i-pixelarticons-sliders" class="size-5" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-bold text-highlighted">Panel</span>
              <span class="block truncate text-xs text-dimmed">
                {{ staff?.username || '—' }}<template v-if="role"> · {{ ROLE_LABEL[role] ?? role }}</template>
              </span>
            </span>
          </NuxtLink>
        </template>
      </UiSideNav>

      <div class="min-w-0">
        <slot />
      </div>
    </div>
  </UiPageShell>
</template>
