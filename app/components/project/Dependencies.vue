<script setup lang="ts">
defineProps<{ dependencies: CatalogDependency[] }>()

const { t } = useI18n()
const localePath = useLocalePath()

// A name in <component :is> does not resolve; see test/unit/dynamic-component.
const link = resolveComponent('NuxtLink')

// Registry: dependency kind -> how it reads and how loudly. Required is the only
// one that changes what somebody has to install, so it is the only one tinted.
const KINDS: Record<string, { label: string, tint: boolean }> = {
  required: { label: 'catalog.version.required', tint: true },
  optional: { label: 'catalog.version.optional', tint: false },
  incompatible: { label: 'catalog.version.incompatible', tint: false },
  embedded: { label: 'catalog.version.embedded', tint: false },
}

const kindOf = (kind: string) => KINDS[kind] ?? KINDS.required!

// A dependency we host is a link; one from somewhere else can only be named,
// and the file path out of the pack manifest is the most honest name we have.
const nameOf = (dep: CatalogDependency) =>
  dep.title || (typeof dep.external?.path === 'string' ? dep.external.path : '—')
</script>

<template>
  <UiPanel class="overflow-hidden">
    <h3 class="px-5 pb-3 pt-4 text-base font-bold text-highlighted">
      {{ t('catalog.version.dependencies') }}
    </h3>

    <p v-if="!dependencies.length" class="border-t border-raised-line px-5 py-6 text-sm text-muted">
      {{ t('catalog.version.noDependencies') }}
    </p>

    <component
      :is="dep.hosted && dep.slug && dep.type ? link : 'div'"
      v-for="dep in dependencies"
      :key="dep.id"
      :to="dep.hosted && dep.slug && dep.type ? localePath(projectPath(dep.type, dep.slug)) : undefined"
      class="flex flex-wrap items-center gap-3 border-t border-raised-line px-5 py-3 transition-colors"
      :class="dep.hosted && dep.slug ? 'hover:bg-white/5' : ''"
    >
      <span
        class="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold"
        :class="kindOf(dep.kind).tint
          ? 'bg-primary/10 text-primary'
          : 'border border-raised-line bg-raised text-muted'"
      >{{ t(kindOf(dep.kind).label) }}</span>

      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold text-highlighted">{{ nameOf(dep) }}</span>
        <span v-if="!dep.hosted" class="block text-xs text-dimmed">
          {{ t('catalog.version.external') }}
        </span>
      </span>

      <span v-if="dep.versionNumber" class="shrink-0 font-mono text-xs text-dimmed">
        {{ dep.versionNumber }}
      </span>
    </component>
  </UiPanel>
</template>
