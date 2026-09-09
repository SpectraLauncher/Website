<script setup lang="ts">

const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ (e: 'token', value: string): void }>()

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const el = ref<HTMLElement>()
let widgetId: string | undefined

declare global {
  interface Window { turnstile?: any }
}

function loadScript() {
  if (window.turnstile) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
  const tag = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT, async: true, defer: true })
  const ready = new Promise<void>((resolve, reject) => {
    tag.addEventListener('load', () => resolve())
    tag.addEventListener('error', () => reject(new Error('turnstile failed to load')))
  })
  if (!existing) document.head.appendChild(tag)
  return ready
}

onMounted(async () => {
  try {
    await loadScript()
  } catch {
    return
  }
  if (!el.value || !window.turnstile) return
  widgetId = window.turnstile.render(el.value, {
    sitekey: props.siteKey,
    theme: 'dark',
    callback: (token: string) => emit('token', token),
    'expired-callback': () => emit('token', ''),
    'error-callback': () => emit('token', ''),
  })
})

onUnmounted(() => {
  if (widgetId !== undefined) window.turnstile?.remove(widgetId)
})

defineExpose({
  reset() {
    if (widgetId !== undefined) {
      window.turnstile?.reset(widgetId)
      emit('token', '')
    }
  },
})
</script>

<template>
  <div ref="el" class="flex min-h-[65px] justify-center" />
</template>
