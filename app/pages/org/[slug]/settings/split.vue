<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const slug = computed(() => String(route.params.slug ?? ''))

interface Member {
  user_id: string
  username: string | null
  name: string | null
  image: string | null
  role: string
  can_receive: boolean
}

const { data, refresh } = await useFetch<{
  shares: Array<{ userId: string, shareBps: number }>
  members: Member[]
}>(() => `/api/org/${encodeURIComponent(slug.value)}/split`)

const busy = ref(false)
const saved = ref(false)
const problem = ref('')

// Percentages in the form, basis points on the wire. People think in whole
// percents and the database stores hundredths of one, so the conversion happens
// once, here.
const percent = ref<Record<string, number>>({})

watchEffect(() => {
  if (!data.value) return
  const next: Record<string, number> = {}
  for (const member of data.value.members) {
    const share = data.value.shares.find(s => s.userId === member.user_id)
    next[member.user_id] = share ? share.shareBps / 100 : 0
  }
  percent.value = next
})

const total = computed(() =>
  Object.values(percent.value).reduce((sum, value) => sum + (Number(value) || 0), 0))

const untouched = computed(() => total.value === 0)
const balanced = computed(() => Math.round(total.value * 100) === 10_000)

async function save() {
  busy.value = true
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/split`, {
      method: 'POST',
      body: {
        shares: Object.entries(percent.value)
          .map(([userId, value]) => ({ userId, shareBps: Math.round(Number(value) * 100) })),
      },
    })
    await refresh()
    saved.value = true
    setTimeout(() => (saved.value = false), 4000)
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = false }
}
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('org.split.title') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('org.split.hint') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <ul class="divide-y divide-default rounded-2xl border border-default">
      <li v-for="member in data?.members ?? []" :key="member.user_id" class="flex items-center gap-3 p-4">
        <img v-if="member.image" :src="member.image" alt="" class="size-8 rounded-full" />

        <div class="flex-1">
          <p class="font-medium">{{ member.name || member.username }}</p>
          <!-- Their share still accrues without an account; it waits as pending
               until they finish onboarding. Worth saying before payday. -->
          <p v-if="!member.can_receive && percent[member.user_id]" class="text-sm text-warning">
            {{ t('org.split.noAccount') }}
          </p>
        </div>

        <UInput
          v-model.number="percent[member.user_id]"
          type="number"
          min="0"
          max="100"
          class="w-24"
        >
          <template #trailing><span class="text-sm text-muted">%</span></template>
        </UInput>
      </li>
    </ul>

    <div class="mt-4 flex items-center justify-between text-sm">
      <span :class="untouched || balanced ? 'text-muted' : 'text-error'">
        {{ t('org.split.total', { total: total.toFixed(2).replace(/\.?0+$/, '') }) }}
      </span>
      <span v-if="untouched" class="text-muted">{{ t('org.split.fallback') }}</span>
    </div>

    <div class="mt-5 flex items-center gap-3">
      <UButton
        class="rounded-xl"
        :label="t('account.save')"
        :loading="busy"
        :disabled="!untouched && !balanced"
        @click="save()"
      />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
