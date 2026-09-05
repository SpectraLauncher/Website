
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const { kind } = await readBody<{ kind?: unknown }>(event) ?? {}
  const retried = await retryFailed(typeof kind === 'string' ? kind : undefined)

  return { retried }
})
