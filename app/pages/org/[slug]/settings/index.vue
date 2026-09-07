<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { ask } = useConfirm()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
const { org, refresh, may } = useOrganization(slug)

const busy = ref('')
const problem = ref('')
const saved = ref(false)

const form = reactive({ name: '', summary: '', description: '' })

watchEffect(() => {
  if (!org.value) return
  form.name = org.value.name
  form.summary = org.value.summary
  form.description = org.value.description
})

const canEdit = computed(() => may('edit_details'))
const canDelete = computed(() => may('delete_organization'))

async function save() {
  busy.value = 'save'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}`, { method: 'PATCH', body: form })
    await refresh()
    saved.value = true
    setTimeout(() => (saved.value = false), 4000)
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
  }
  finally { busy.value = '' }
}

async function uploadLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  busy.value = 'logo'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/logo`, {
      method: 'POST',
      body: await file.arrayBuffer(),
      headers: { 'content-type': file.type },
    })
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
  }
  finally { busy.value = '' }
}

async function destroy() {
  const ok = await ask({
    title: t('catalog.org.confirmDelete', { name: org.value?.name }),
    body: t('catalog.org.confirmDeleteBody'),
    confirmLabel: t('catalog.org.delete'),
    danger: true,
  })
  if (!ok) return

  busy.value = 'delete'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}`, { method: 'DELETE' })
    await navigateTo(localePath('/organizations'))
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
    busy.value = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
      <h2 class="mb-5 text-lg font-semibold">{{ t('catalog.org.details') }}</h2>

      <div class="mb-5 flex flex-wrap items-center gap-4">
        <span class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <img v-if="org?.logo" :src="org.logo" alt="" class="size-full object-cover">
          <UIcon v-else name="i-pixelarticons-users" class="size-8 text-dimmed" />
        </span>
        <label
          v-if="canEdit"
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-600/50 bg-black/30 px-3 py-2 text-sm transition-colors hover:border-zinc-500"
        >
          <UIcon name="i-pixelarticons-camera" class="size-4" />
          {{ busy === 'logo' ? t('catalog.org.uploading') : t('catalog.org.uploadLogo') }}
          <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadLogo">
        </label>
      </div>

      <div class="space-y-4">
        <UFormField :label="t('catalog.org.name')">
          <UInput v-model="form.name" :disabled="!canEdit" :maxlength="64" class="w-full" />
        </UFormField>

        <UFormField :label="t('catalog.org.summary')" :help="t('create.organization.descriptionHint')">
          <UTextarea
            v-model="form.summary"
            :rows="2"
            :maxlength="400"
            :disabled="!canEdit"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('catalog.org.readme')" :help="t('catalog.org.readmeHint')">
          <UTextarea
            v-model="form.description"
            :rows="14"
            :disabled="!canEdit"
            :placeholder="t('catalog.org.readmePlaceholder')"
            class="w-full font-mono text-sm"
          />
        </UFormField>
      </div>

      <div v-if="canEdit" class="mt-5 flex items-center gap-3">
        <UButton
          class="rounded-xl"
          :label="t('catalog.org.save')"
          :loading="busy === 'save'"
          @click="save"
        />
        <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
      </div>
    </div>

    <div v-if="canDelete" class="rounded-3xl border border-error/40 bg-error/5 p-6">
      <h2 class="text-lg font-semibold">{{ t('catalog.org.delete') }}</h2>
      <p class="mt-2 max-w-prose text-sm/relaxed text-muted">{{ t('catalog.org.deleteHint') }}</p>
      <UButton
        class="mt-4 rounded-xl"
        color="error"
        variant="subtle"
        icon="i-pixelarticons-trash"
        :label="t('catalog.org.delete')"
        :loading="busy === 'delete'"
        @click="destroy"
      />
    </div>
  </div>
</template>
