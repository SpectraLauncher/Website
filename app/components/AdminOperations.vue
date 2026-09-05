<script setup lang="ts">
interface Finding { code: string, severity: string, detail: string }

interface FlaggedFile {
  id: string
  filename: string
  verdict: string
  findings: Finding[]
  projectTitle: string
  versionNumber: string
}

const { t } = useI18n()

const scans = ref<{ flagged: FlaggedFile[], unscanned: number } | null>(null)
const images = ref<{ tracked: number, orphaned: number, bytes: number } | null>(null)
const jobs = ref<{ pending: number, running: number, failed: number } | null>(null)

const busy = ref('')
const error = ref('')

async function load() {
  busy.value = 'load'
  error.value = ''
  try {
    const [scan, image, job] = await Promise.all([
      $fetch<{ flagged: FlaggedFile[], unscanned: number }>('/api/admin/catalog/scans'),
      $fetch<{ stats: typeof images.value }>('/api/admin/catalog/images'),
      $fetch<{ queue: typeof jobs.value }>('/api/admin/catalog/jobs'),
    ])
    scans.value = scan
    images.value = image.stats
    jobs.value = job.queue
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

onMounted(load)

const act = async (key: string, run: () => Promise<unknown>) => {
  busy.value = key
  error.value = ''
  try {
    await run()
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

const rescan = (id: string) =>
  act('scan:' + id, () => $fetch(`/api/admin/catalog/scans/${id}`, { method: 'POST' }))

const scanAll = () =>
  act('scanAll', () => $fetch('/api/admin/catalog/scans', { method: 'POST' }))

const sweep = () =>
  act('sweep', () => $fetch('/api/admin/catalog/images', { method: 'POST' }))

const retry = () =>
  act('retry', () => $fetch('/api/admin/catalog/jobs', { method: 'POST', body: {} }))

const SEVERITY: Record<string, 'error' | 'warning' | 'neutral'> = {
  high: 'error',
  medium: 'warning',
  low: 'neutral',
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
</script>

<template>
  <div class="space-y-4">
    <UAlert v-if="error" color="error" variant="subtle" class="rounded-2xl" :description="error" />

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p class="text-xs text-dimmed">{{ t('ops.unscanned') }}</p>
        <p class="text-2xl font-semibold">{{ scans?.unscanned ?? '—' }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p class="text-xs text-dimmed">{{ t('ops.orphaned') }}</p>
        <p class="text-2xl font-semibold">{{ images?.orphaned ?? '—' }}</p>
        <p v-if="images" class="text-xs text-dimmed">{{ megabytes(images.bytes) }} MB {{ t('ops.tracked') }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p class="text-xs text-dimmed">{{ t('ops.jobs') }}</p>
        <p class="text-2xl font-semibold">{{ jobs?.pending ?? '—' }}</p>
        <p v-if="jobs?.failed" class="text-xs text-error">{{ t('ops.failed', { n: jobs.failed }) }}</p>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        size="sm"
        variant="subtle"
        color="neutral"
        icon="i-lucide-refresh-cw"
        :loading="busy === 'load'"
        :label="t('catalog.admin.refresh')"
        @click="load"
      />
      <UButton
        v-if="scans?.unscanned"
        size="sm"
        variant="subtle"
        color="warning"
        icon="i-lucide-scan-search"
        :loading="busy === 'scanAll'"
        :label="t('ops.scanAll', { n: scans.unscanned })"
        @click="scanAll"
      />
      <UButton
        size="sm"
        variant="subtle"
        color="neutral"
        icon="i-lucide-broom"
        :disabled="!images?.orphaned"
        :loading="busy === 'sweep'"
        :label="t('ops.sweep')"
        @click="sweep"
      />
      <UButton
        v-if="jobs?.failed"
        size="sm"
        variant="subtle"
        color="warning"
        icon="i-lucide-rotate-ccw"
        :loading="busy === 'retry'"
        :label="t('ops.retry')"
        @click="retry"
      />
    </div>

    <div v-if="scans?.flagged.length" class="rounded-2xl border border-error/40 bg-error/5 p-5">
      <h3 class="mb-3 text-sm font-semibold">{{ t('ops.flagged') }}</h3>

      <ul class="space-y-3">
        <li
          v-for="file in scans.flagged"
          :key="file.id"
          class="rounded-xl border border-white/10 bg-white/5 p-3"
        >
          <div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span class="font-medium">{{ file.projectTitle }}</span>
            <span class="text-xs text-dimmed">{{ file.versionNumber }} · {{ file.filename }}</span>
            <span class="flex-1"></span>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-refresh-cw"
              :loading="busy === 'scan:' + file.id"
              :aria-label="t('ops.rescan')"
              @click="rescan(file.id)"
            />
          </div>

          <ul class="space-y-1">
            <li
              v-for="finding in file.findings"
              :key="finding.code + finding.detail"
              class="flex flex-wrap items-center gap-2 text-xs"
            >
              <UBadge
                size="sm"
                variant="subtle"
                :color="SEVERITY[finding.severity] ?? 'neutral'"
                :label="t(`ops.findings.${finding.code}`)"
              />
              <span class="break-all text-dimmed">{{ finding.detail }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>
