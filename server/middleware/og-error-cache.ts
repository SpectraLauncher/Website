export default defineEventHandler((event) => {
  if (!event.path.startsWith('/_og/')) return

  const res = event.node.res
  const writeHead = res.writeHead.bind(res)

  res.writeHead = ((status: number, ...rest: unknown[]) => {
    if (status >= 400 && !res.headersSent) {
      res.setHeader('cache-control', 'no-store, max-age=0')
    }
    return writeHead(status, ...rest as [])
  }) as typeof res.writeHead
})
