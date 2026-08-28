<script setup lang="ts">
const { t } = useI18n()

const COOKIES = [
  { name: 'better-auth.session_token', kind: 'essential', life: 'cookies.life.session' },
  { name: 'spectra_lang', kind: 'functional', life: 'cookies.life.year' },
  { name: 'cf_clearance', kind: 'security', life: 'cookies.life.cloudflare' }
]

const STORAGE = [
  { name: 'spectra_cookie_notice', key: 'cookies.storage.notice' }
]

const cleared = ref(false)

function clearLocal() {
  try {
    localStorage.removeItem('spectra_cookie_notice')
    document.cookie = 'spectra_lang=; Max-Age=0; path=/'
    cleared.value = true
  }
  catch { /* nie ma czego czyscic */ }
}
</script>

<template>
  <LegalPage section="cookies">
    <section class="mt-10">
      <h2 class="mb-3 text-xl font-semibold tracking-tight">{{ t('cookies.tableTitle') }}</h2>

      <div class="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
        <table class="w-full min-w-[560px] text-left text-sm">
          <thead class="text-xs text-dimmed">
            <tr class="border-b border-white/10">
              <th class="px-4 py-3 font-medium">{{ t('cookies.colName') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('cookies.colKind') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('cookies.colLife') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('cookies.colWhy') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in COOKIES" :key="row.name" class="border-b border-white/5 last:border-0 align-top">
              <td class="px-4 py-3 font-mono text-xs">{{ row.name }}</td>
              <td class="px-4 py-3 text-xs">{{ t(`cookies.kind.${row.kind}`) }}</td>
              <td class="px-4 py-3 text-xs text-muted">{{ t(row.life) }}</td>
              <td class="px-4 py-3 text-xs/relaxed text-muted">{{ t(`cookies.why.${row.name.replace(/[.\-]/g, '_')}`) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 class="mb-3 mt-8 text-xl font-semibold tracking-tight">{{ t('cookies.storageTitle') }}</h2>
      <p v-for="row in STORAGE" :key="row.name" class="text-sm/relaxed text-muted">
        <code class="font-mono text-xs">{{ row.name }}</code> — {{ t(row.key) }}
      </p>

      <div class="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
        <h2 class="mb-2 text-lg font-semibold tracking-tight">{{ t('cookies.manageTitle') }}</h2>
        <p class="mb-4 text-sm/relaxed text-muted">{{ t('cookies.manageBody') }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <UButton size="sm" color="neutral" variant="subtle" class="rounded-xl" icon="i-lucide-eraser" :label="t('cookies.clear')" @click="clearLocal" />
          <span v-if="cleared" class="text-sm text-primary">{{ t('cookies.cleared') }}</span>
        </div>
      </div>
    </section>
  </LegalPage>
</template>
