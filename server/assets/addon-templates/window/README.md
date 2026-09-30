# Server watch

An addon that opens its own window from a button in the title bar.

- `contributes.windows` declares the window: its page, title and size
- the `titlebar` button opens it with the `window` action
- `servers:ping` lets the page call `spectra.servers.ping`
- `network:usespectra.app` lets the page call `spectra.http.fetch` on that host and nowhere else; only `https`
  addresses work

A page cannot use `fetch` or `XMLHttpRequest` directly: the launcher blocks every request that does not go through
`spectra.http.fetch`.
