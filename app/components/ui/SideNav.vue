<script setup lang="ts">
const props = defineProps<{ items: SideNavItem[] }>()
// Optional: a sidebar whose every entry is a link is bound with :model-value
// alone, and nothing ever writes back.
const active = defineModel<string>({ default: '' })

const sections = computed(() => groupSideNav(props.items))
</script>

<template>
  <nav class="flex gap-1 overflow-x-auto rounded-2xl border border-panel-line bg-panel p-2.5 lg:flex-col lg:overflow-x-visible">
    <!-- Whose sidebar this is. Hidden on a narrow screen, where the nav is a
         scrolling row of entries and a card would eat the whole first screen. -->
    <div v-if="$slots.header" class="hidden lg:block">
      <slot name="header" />
      <div class="mx-1 mb-1.5 mt-2.5 h-px bg-inset-line"></div>
    </div>

    <template v-for="section in sections" :key="section.title">
      <p
        v-if="section.title"
        class="hidden px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.11em] text-dimmed first:pt-1 lg:block"
      >{{ section.title }}</p>

      <component
        :is="item.to ? 'NuxtLink' : 'button'"
        v-for="item in section.items"
        :key="item.id"
        :to="item.to"
        :type="item.to ? undefined : 'button'"
        class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
        :class="active === item.id
          ? 'bg-white/10 text-highlighted'
          : 'text-muted hover:bg-white/5 hover:text-highlighted'"
        :aria-current="active === item.id ? 'page' : undefined"
        @click="item.to || (active = item.id)"
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        <span class="whitespace-nowrap">{{ item.label }}</span>

        <UBadge
          v-if="item.badge"
          size="sm"
          color="primary"
          variant="subtle"
          class="ml-auto"
          :label="String(item.badge)"
        />
      </component>
    </template>
  </nav>
</template>
