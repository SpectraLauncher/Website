// Prices a cart without creating anything. The page asks for this on every
// change, and the checkout prices it again from the same function rather than
// trusting the numbers back.
//
// No account needed: buying as a guest is allowed, so pricing has to be too.
export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const body = await readBody<{ items?: unknown }>(event) ?? {}
  const cart = await priceCart(viewer, body.items, await commissionSettings())

  return {
    items: cart.lines.map(line => ({
      projectId: line.projectId,
      slug: line.slug,
      title: line.title,
      icon: line.icon,
      path: projectPath(line.type as never, line.slug),
      // The buyer's side of the line only. What the platform takes out of it is
      // between us and the seller.
      priceMinor: line.priceMinor,
    })),
    totalMinor: cart.totalMinor,
    problems: cart.problems,
    max: MAX_CART_ITEMS,
  }
})
