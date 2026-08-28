export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()

  try {
    await $fetch('/api/admin/session', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    })
  }
  catch (e) {
    const status = (e as { statusCode?: number, status?: number }).statusCode
      ?? (e as { status?: number }).status
      ?? 404

    if (status === 401) {
      return navigateTo({ path: localePath('/login'), query: { next: to.fullPath } })
    }

    throw createError({ statusCode: 404, fatal: true })
  }
})
