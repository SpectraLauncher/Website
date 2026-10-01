Every addon is a `.zip` with `addon.json` at the top of the archive. The launcher
and this site read the same file with the same rules, so an addon that uploads here
installs in the launcher.

## Example

```json
{
  "id": "my-pages",
  "name": "My pages",
  "version": "1.0.0",
  "description": "A page in the sidebar and a tab on every instance.",
  "api": 1,
  "launcher": ">=1.0.0",
  "main": "main.js",
  "permissions": ["instances:read"],
  "contributes": {
    "pages": [
      { "id": "playtime", "title": "%playtime%", "icon": "icons/clock.svg", "entry": "ui/playtime.html" }
    ],
    "instanceTabs": [
      { "id": "notes", "title": "%notes%", "entry": "ui/notes.html" }
    ],
    "settings": "ui/settings.html",
    "locales": { "en": "locales/en.json", "pl": "locales/pl.json" },
    "buttons": [
      {
        "id": "open-playtime",
        "slot": "sidebar.menu",
        "title": "%playtime%",
        "icon": "icons/clock.svg",
        "action": { "type": "page", "page": "playtime" }
      }
    ]
  }
}
```

## Fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Up to 64 characters: `a-z`, `0-9` and dashes, not at the start or the end. It identifies the addon and cannot change after the first version is published |
| `name` | yes | Up to 64 characters |
| `version` | yes | Letters, digits, dots, dashes and `+`, up to 60 characters. The site takes the version number from here |
| `api` | yes | The version of the addon API. Currently `1` |
| `description` | no | Up to 400 characters |
| `launcher` | no | The launcher versions the addon works with, as a range: `>=1.0.0`, `^1.2`, `>=1.0.0, <2.0.0`. Without it the addon runs on any version. The site shows this range next to every version |
| `main` | no | A `.js` or `.mjs` file that runs in the background while the addon is on |
| `backend` | no | A `.wasm` file, described on the Backend page |
| `permissions` | no | What the addon may do, up to 30 entries |
| `contributes` | no | Everything the addon adds to the launcher |

An addon has to add something: `main`, `backend` or at least one entry in
`contributes`. Paths are relative to the root of the archive and use `/`.

## Permissions

| Permission | Allows |
|---|---|
| `instances:read` | Listing instances, their content and worlds |
| `instances:write` | Renaming instances, changing their memory and group, turning content on and off |
| `instances:launch` | Starting and stopping the game |
| `logs:read` | Reading the game console and log files |
| `servers:ping` | Checking Minecraft servers |
| `account:read` | The Minecraft and Spectra account names |
| `skins:read` | Saved skins |
| `resourcepacks:read` | Listing the files inside a resource pack and reading them |
| `resourcepacks:write` | Saving an edited copy of a resource pack |
| `files:read:<folder>` | Reading one folder (or file) at the top of the instance's game folder, for example `files:read:config` or `files:read:options.txt` |
| `files:write:<folder>` | Creating, changing and removing files there too, for example `files:write:saves`. `mods`, `kubejs`, `scripts` and `coremods` cannot be written, and neither can program files such as `.jar`, `.dll` or `.exe` anywhere |
| `network:<host>` | `spectra.http.fetch` to exactly that host over `https`, for example `network:api.example.com` |

Storage, notifications, the addon's own pages and windows, and the launcher's
version, language and theme need no permission.

## contributes

### pages, instanceTabs

Lists of `{ "id", "title", "entry", "icon" }`. `entry` is an `.html` file and
`icon` an optional `.svg`, `.png` or `.webp`. A page is opened by a button or by
`spectra.ui.navigate`. An instance tab appears on every instance page and gets the
instance in `spectra.context.instanceId`.

### settings

An `.html` file shown under the addon in Settings → Addons.

### windows

A list of `{ "id", "title", "entry", "width", "height", "resizable" }`. Width
200–3840 and height 150–2160, both optional (800 × 600 by default). `resizable`
is `true` unless set to `false`. The window title is plain text: it is not
translated.

### buttons

A list of `{ "id", "slot", "title", "icon", "action" }`. `slot` is one of the
places listed on the Addons page. The action is one of:

| Action | Does |
|---|---|
| `{ "type": "url", "url": "https://…" }` | Opens the link in the browser |
| `{ "type": "page", "page": "<page id>" }` | Opens one of the addon's pages |
| `{ "type": "window", "window": "<window id>" }` | Opens one of the addon's windows |
| `{ "type": "command", "command": "<name>" }` | Runs a command registered by `main.js`, so it needs `main` |

A command started from `instance.menu` or `instance.header` gets `{ instanceId }`.

### themes

A list of `{ "id", "name", "file" }`, where `file` is a `.json`:

```json
{ "mode": "oled", "accent": "violet", "background": "themes/night.png", "tint": "#c4b5fd" }
```

- `mode`: `dark`, `oled` or `squared`
- `accent`: `sky`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`, `red`,
  `orange`, `amber`, `green`, `emerald`, `teal` or `cyan`
- `background`: a `.png`, `.jpg` or `.webp` in the archive. An animated `.webp` moves in the launcher too
- `tint`: a colour written as `#rrggbb`. The launcher uses it for the text, borders and panels that are
  normally white and grey

All four are optional. The player picks the theme in Settings.

### locales

`{ "en": "locales/en.json", "pl": "locales/pl.json" }`. Each file maps keys to
strings. A title written as `%key%` in `addon.json` shows the string in the
launcher's language, then in English, then the key itself. Up to 500 keys per
file, 500 characters per string.

## Limits

- up to 20 entries in every list and 30 permissions
- the archive up to 100 MB and 2000 files, with no paths leading outside it
- JSON files up to 1 MB
