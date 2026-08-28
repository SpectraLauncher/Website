export default defineEventHandler(async () => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'not found' })

  await useStorage('cache').clear()
  return { cleared: true }
})
