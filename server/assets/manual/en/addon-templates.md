Four complete addons to start from. Each one installs as it is: load it in
developer mode, look around, then change the `id` in `addon.json` and make it
yours. Every archive has a `README.md` that explains its files.

| Template | What it shows | Download |
|---|---|---|
| Theme | A theme with its own background, translations and a link on the home screen. No code | [spectra-addon-theme.zip](/api/catalog/addon-templates/theme) |
| Pages | A page in the sidebar, a tab on every instance, a settings screen, a command in the instance menu and a listener for the game closing | [spectra-addon-page.zip](/api/catalog/addon-templates/page) |
| Window | A title-bar button that opens its own window, checks Minecraft servers and fetches from one allowed host | [spectra-addon-window.zip](/api/catalog/addon-templates/window) |
| Backend | A page that hands its work to `backend.wasm`, with the Rust source and the build steps | [spectra-addon-backend.zip](/api/catalog/addon-templates/backend) |

All four set `"launcher": ">=1.0.0"`, the first launcher version with addons.
Raise it in `addon.json` when your addon needs something a newer launcher added.
