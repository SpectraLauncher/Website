An addon changes the Spectra launcher: a theme, a button, a page, a whole window or
a job that runs in the background. Addons are published here and installed from
the launcher, starting with launcher 1.0.0, and each one runs in a sandbox that
lets it do only what it asked for.

## What an addon can add

| Part | What it is | Code |
|---|---|---|
| Themes | A mode, an accent colour and a background image | none |
| Translations | Names of everything the addon adds, per language | none |
| Buttons | Links, pages, windows or commands placed in the launcher | none, except commands |
| Pages | Full screens inside the launcher, opened from a button | HTML, CSS, JavaScript |
| Instance tabs | A tab on every instance page | HTML, CSS, JavaScript |
| Settings | A screen under Settings → Addons | HTML, CSS, JavaScript |
| Windows | Separate launcher windows | HTML, CSS, JavaScript |
| Background script | `main.js`, running while the addon is on | JavaScript |
| Backend | `backend.wasm`, for heavier work | anything that compiles to WebAssembly |

## Where buttons go

| Slot | Place in the launcher |
|---|---|
| `sidebar.menu` | The left sidebar, next to Home and Worlds |
| `sidebar.footer` | The bottom of the left sidebar |
| `titlebar` | The window's title bar |
| `home.header` | The top of the home screen |
| `instance.header` | The top of an instance page |
| `instance.menu` | The menu of an instance on the home screen |
| `worlds.header` | The top of the worlds page |
| `screenshots.header` | The top of the screenshots page |
| `skins.header` | The top of the skins page |
| `settings.header` | The top of the settings page |

## Languages

Pages, tabs, settings and windows are plain HTML, CSS and JavaScript. No framework
is required and a build step is up to you: the launcher only needs the files.

The backend is WebAssembly built with an [Extism](https://extism.org) plugin kit,
so it can be written in Rust, Go, C, Zig, AssemblyScript, C# and the other
languages Extism supports.

## The sandbox

Addon code never runs inside the launcher itself.

- Every page, tab, window, settings screen and `main.js` runs in an isolated frame
  served from its own origin. It cannot reach the launcher's internals or commands.
- The only way out is `window.spectra`, and every call is checked against the
  permissions in `addon.json`.
- A page cannot load scripts from the internet, call `fetch` directly or open
  other sites. Network access goes through `spectra.http.fetch`, only over `https`
  and only to hosts the addon listed.
- `backend.wasm` has no files, clock or network. It reaches the launcher through
  the same permissions.

Before installing, the launcher shows the player what the addon asks for. An update
that asks for more shows what is new and asks again.

## Installing

- From this site: **Install in Spectra** on the addon's page opens the launcher.
- From the launcher: Settings → Addons lists published addons.
- While developing: turn on developer mode in Settings → Addons and load a folder or
  a `.zip`. An addon loaded this way is marked as unverified.

The fastest way to start is one of the templates.
