# My theme

A theme needs no code. Everything here is data the launcher reads:

- `addon.json` names the theme and adds a link to the home screen
- `themes/night.json` picks the mode (`dark`, `oled`, `squared`), the accent colour and a background image
- `locales/*.json` translate the names written as `%key%` in `addon.json`

Change the `id` in `addon.json` before you publish, zip the folder's contents (with `addon.json` at the top of the
archive) and upload the zip as a new addon on usespectra.app.
