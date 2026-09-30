Every page, instance tab, window, settings screen and `main.js` gets
`window.spectra` before its first script runs. Every method returns a promise. A
call the addon has no permission for is rejected with an error whose `code` is
`permission_denied`.

```js
const instances = await spectra.instances.list()
await spectra.ui.toast(`${instances.length} instances`, { color: 'success' })
```

## Context

`spectra.context` holds what the launcher passed to the page. An instance tab gets
`instanceId`.

## instances

| Method | Permission | Result |
|---|---|---|
| `list()` | `instances:read` | Every instance: `id`, `name`, `mcVersion`, `loader`, `group`, `memoryMb`, `createdAt`, `lastPlayed`, `playtimeSeconds` |
| `get(id)` | `instances:read` | One instance |
| `content(id, kind)` | `instances:read` | Files of `kind` (`mod`, `resourcepack`, `shader` or `datapack`), each with `filename`, `enabled`, `name` and `version` |
| `worlds(id)` | `instances:read` | The instance's worlds |
| `isRunning(id)` | `instances:read` | `true` while the game runs |
| `update(id, { name, memoryMb, group })` | `instances:write` | The updated instance. `memoryMb` 512–65536, `group: null` removes the group |
| `setContentEnabled(id, kind, filename, enabled)` | `instances:write` | Turns one file on or off |
| `launch(id)` | `instances:launch` | Starts the game |
| `stop(id)` | `instances:launch` | Stops it |

## logs

| Method | Permission | Result |
|---|---|---|
| `console(id, cursor)` | `logs:read` | `{ lines, cursor, reset }`: console lines since `cursor`. Pass the returned `cursor` next time |
| `list(id)` | `logs:read` | The instance's log files |
| `read(id, rel)` | `logs:read` | The text of one log file |

## servers, account, skins

| Method | Permission | Result |
|---|---|---|
| `servers.ping(host, port)` | `servers:ping` | `{ online, max, latency_ms, version, protocol, motd, favicon }`. The port defaults to 25565 |
| `account.minecraft()` | `account:read` | `{ uuid, username, kind }` or `null` |
| `account.spectra()` | `account:read` | `{ username, name, image }` or `null` |
| `skins.list()` | `skins:read` | Saved skins |

## files

Paths start at the instance's game folder, such as `config/example.json`. The first part of the path has to be a
folder named in a `files:read:<folder>` or `files:write:<folder>` permission; `write` allows reading as well.

| Method | Permission | Result |
|---|---|---|
| `list(id, path)` | read | The folder's entries: `name`, `dir`, `size`, `modified` (milliseconds) |
| `read(id, path, { encoding })` | read | The file as text, or as base64 with `encoding: 'base64'`. Up to 10 MB |
| `write(id, path, data, { encoding })` | write | Creates the file and its folders, or replaces it. `data` is text, or base64 with `encoding: 'base64'` |
| `remove(id, path)` | write | Removes a file or a folder |
| `mkdir(id, path)` | write | Creates a folder |

Nothing is lost for good: a file that `write` replaces or `remove` takes away is moved to
`addon-trash/<addon id>/` in the instance folder, next to the game folder, where the player can get it back. The game
may overwrite files it keeps open while it runs.

## resourcepacks

`filename` is the pack's name in the instance's `resourcepacks` folder, as `instances.content(id, 'resourcepack')`
lists it. Zipped packs and folders both work.

| Method | Permission | Result |
|---|---|---|
| `files(id, filename)` | `resourcepacks:read` | `{ files, mcmeta, edit }`: every file with `path` and `size`, `pack.mcmeta` parsed, and for a copy saved by `save` its `source` and the `excluded` paths |
| `read(id, filename, path)` | `resourcepacks:read` | `{ data }`: one file from inside the pack as base64, up to 4 MB |
| `save(id, filename, excluded)` | `resourcepacks:write` | `{ filename }`: writes `<name> (edited).zip` without the `excluded` paths, turns the original off and puts the copy in its place in the game's pack order. Saving again replaces the copy. It fails while the game runs |

## http

```js
const response = await spectra.http.fetch('https://api.example.com/status', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hello: 'world' }),
})
// { status, ok, contentType, body }
```

- only `https`, only to hosts listed as `network:<host>`, and redirects too
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `HEAD`
- the request body is a string up to 1 MB, the response up to 10 MB, 15 seconds
  in total
- `Cookie`, `Origin`, `Referer`, `Host`, `User-Agent` and connection headers are
  dropped

## storage

Storage of JSON values for the addon alone, up to 5 MB in total. It is deleted
when the addon is uninstalled.

| Method | Result |
|---|---|
| `get(key)` | The value, or `null` |
| `set(key, value)` | Saves any JSON value |
| `remove(key)` | Deletes it |
| `keys()` | Every key |

## ui

| Method | Result |
|---|---|
| `toast(title, { description, color })` | A notification. `color`: `success`, `info`, `warning`, `error` |
| `navigate(page)` | Opens one of the addon's pages |
| `openWindow(window)` | Opens one of the addon's windows |
| `openUrl(url)` | Asks the player, then opens an `https` link. Resolves to whether it was opened |
| `confirm(message)` | Asks the player. Resolves to `true` or `false` |

## launcher

| Method | Result |
|---|---|
| `version()` | The launcher version, for example `1.0.0` |
| `locale()` | The launcher's language, for example `pl` |
| `theme()` | `{ mode, accent }` of the current theme |

## backend

`spectra.backend.call(fn, input)` runs a function in `backend.wasm` with `input`
as JSON and resolves to its output, parsed when it is JSON.

## events

`spectra.events.on(name, handler)` returns a function that stops listening.

| Event | Payload |
|---|---|
| `game:launch` | `{ instanceId }` |
| `game:exit` | `{ instanceId, code }` |
| `instance:created` | `{ instanceId }` |
| `instance:removed` | `{ instanceId }` |

## commands

`spectra.commands.register(name, handler)` in `main.js` creates a command for
buttons with the `command` action. The handler gets `{ instanceId }` when the
button sits on an instance.

```js
spectra.commands.register('show-name', async ({ instanceId }) => {
  const instance = await spectra.instances.get(instanceId)
  await spectra.ui.toast(instance.name)
})
```

## What a page may load

Scripts, styles, images, fonts and media come only from the addon's own files, plus
inline `<script>` and `<style>` and `data:` or `blob:` images. Other sites, frames,
workers and form submissions are blocked. Link to your own files with relative
paths, such as `style.css` next to the page.
