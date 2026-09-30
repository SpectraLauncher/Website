# My pages

An addon with its own code. The launcher runs every page and `main.js` in an isolated frame, and they reach the
launcher only through `window.spectra`, which is there before your first script runs.

- `main.js` runs in the background while the addon is on: it registers the `show-name` command used by the button in
  the instance menu, and listens for `game:exit`
- `ui/playtime.html` is a page opened from the sidebar
- `ui/notes.html` is a tab on every instance page; it reads the instance from `spectra.context.instanceId`
- `ui/settings.html` appears in Settings → Addons

`instances:read` in `addon.json` is what lets it list instances. Anything the addon calls without the permission it
needs is refused.
