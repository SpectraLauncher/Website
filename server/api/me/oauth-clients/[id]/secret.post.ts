
// Rotating is the answer to a leaked secret, and it must not mean re-registering
// every redirect the application uses.
export default defineEventHandler(async (event) => {
  const client = await requireOwnClient(event)
  return { secret: await rotateSecret(client.id) }
})
