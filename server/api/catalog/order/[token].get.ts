// What a guest holds instead of an account. The token is the whole credential,
// so it is checked against a paid sale and nothing else about the request
// matters - no session, no cookie.
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const token = String(getRouterParam(event, 'token') ?? '')

  // Short enough to be a typo rather than a token; not worth a database round
  // trip, and not worth telling apart from a wrong one either.
  const sale = token.length >= 16 ? await saleByToken(token) : undefined

  // A token that never existed and a sale that was disputed away look the same
  // from out here, which is the point.
  if (!sale) throw createError({ statusCode: 404, statusMessage: 'no such order' })

  const items = await itemsOfSale(sale.id)
  const ids = items.map(item => item.project_id).filter(Boolean) as string[]
  const files = await primaryFilesFor(ids)

  return {
    email: sale.buyer_email,
    totalMinor: Number(sale.total_minor),
    items: items.map(item => ({
      title: item.title,
      priceMinor: Number(item.price_minor),
      projectId: item.project_id,
      // Null once a project is gone. The row stays, so the receipt still says
      // what was bought even when there is nothing left to hand over.
      file: item.project_id ? files.get(item.project_id) ?? null : null,
    })),
  }
})
