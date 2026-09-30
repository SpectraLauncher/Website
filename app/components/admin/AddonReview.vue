<script setup lang="ts">
interface CodeFile {
  name: string
  size: number
  minified: boolean
  dynamic: boolean
}

const props = defineProps<{
  version: { id: string, number: string, meta: Record<string, unknown> } | null
}>()

const ticked = defineModel<string[]>({ default: () => [] })

const { t } = useI18n()

const files = ref<CodeFile[]>([])
const failed = ref(false)
const loading = ref(false)

const access = computed(() => (props.version ? addonAccess(props.version.meta) : null))

const sizeLabel = (bytes: number) =>
  bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`

function toggle(item: string, on: boolean | 'indeterminate') {
  ticked.value = on === true
    ? [...new Set([...ticked.value, item])]
    : ticked.value.filter(i => i !== item)
}

async function load() {
  files.value = []
  failed.value = false
  if (!props.version) return
  loading.value = true
  try {
    const res = await $fetch<{ files: CodeFile[] }>(`/api/admin/catalog/versions/${props.version.id}/code`)
    files.value = res.files
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

watch(() => props.version?.id, load, { immediate: true })
</script>

<template>
  <div class="rounded-2xl border border-raised-line bg-raised p-4">
    <h3 class="text-sm font-semibold">
      {{ t('catalog.admin.addonReview.title') }}
      <span v-if="version" class="font-mono font-normal text-dimmed">{{ version.number }}</span>
    </h3>

    <p v-if="!version" class="mt-2 text-sm text-muted">{{ t('catalog.admin.addonReview.noVersion') }}</p>

    <template v-else>
      <ul v-if="access && (access.permissions.length || access.hosts.length)" class="mt-3 space-y-1.5 text-sm">
        <li v-for="permission in access.permissions" :key="permission" class="flex items-start gap-2">
          <UIcon name="i-pixelarticons-lock" class="mt-0.5 size-3.5 shrink-0 text-dimmed" />
          <span>
            {{ t(`catalog.addonAccess.permissions.${permissionKey(permission)}`) }}
            <span class="font-mono text-xs text-dimmed">{{ permission }}</span>
          </span>
        </li>
        <li v-for="host in access.hosts" :key="host" class="flex items-start gap-2">
          <UIcon name="i-pixelarticons-globe" class="mt-0.5 size-3.5 shrink-0 text-dimmed" />
          <span>{{ t('catalog.addonAccess.network') }} <span class="font-mono">{{ host }}</span></span>
        </li>
      </ul>
      <p v-else class="mt-3 text-sm text-muted">{{ t('catalog.addonAccess.none') }}</p>

      <p class="mt-4 mb-1.5 text-xs text-dimmed">{{ t('catalog.admin.addonReview.files') }}</p>
      <p v-if="loading" class="text-sm text-muted">…</p>
      <p v-else-if="failed" class="text-sm text-error">{{ t('catalog.admin.addonReview.unreadable') }}</p>
      <p v-else-if="!files.length" class="text-sm text-muted">{{ t('catalog.admin.addonReview.noCode') }}</p>
      <ul v-else class="space-y-1 text-sm">
        <li v-for="file in files" :key="file.name" class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 truncate font-mono text-xs">{{ file.name }}</span>
          <span class="text-xs text-dimmed">{{ sizeLabel(file.size) }}</span>
          <UBadge v-if="file.minified" size="sm" variant="subtle" color="warning" :label="t('catalog.admin.addonReview.minified')" />
          <UBadge v-if="file.dynamic" size="sm" variant="subtle" color="error" :label="t('catalog.admin.addonReview.dynamic')" />
        </li>
      </ul>

      <div class="mt-4 space-y-2">
        <UCheckbox
          v-for="item in ADDON_REVIEW_ITEMS"
          :key="item"
          :model-value="ticked.includes(item)"
          :label="t(`catalog.admin.addonReview.items.${item}`)"
          @update:model-value="toggle(item, $event)"
        />
      </div>
    </template>
  </div>
</template>
