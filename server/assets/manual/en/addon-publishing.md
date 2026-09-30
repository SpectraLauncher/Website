## Try it first

Turn on developer mode in the launcher's Settings → Addons, then load the addon's
folder or a `.zip`. A folder can be reloaded after every change with the reload
button next to it. An addon loaded this way is marked as unverified and asks for
the same permissions as a published one.

## Package it

Zip the contents of the addon's folder so that `addon.json` sits at the top of the
archive, not inside another folder. Leave out what you do not ship, such as
`node_modules` or Rust's `target`.

## Create the project

**New project** on this site, type **Addon**:

1. **License.** Required. An open license (MIT, Apache, GPL and the like) also
   needs a link to the source code on GitHub, GitLab or Codeberg.
2. **Description.** A summary, a description, categories and an icon.
3. **First version.** Upload the `.zip`. The site reads `addon.json` and fills in
   the version number and the launcher range; they cannot be typed in by hand, so
   change them in `addon.json`. The addon's `id` is fixed from now on: a later
   version with a different `id` is refused.
4. **Review.** Send it to the moderators.

## Review

A moderator looks at the addon once, with a checklist:

- is every permission needed for what the addon says it does
- does every host it connects to fit that
- is the code readable, not obfuscated or packed into one line
- does `backend.wasm`, if there is one, have a stated purpose and a sensible size

After approval, new versions go live straight away, with one exception: a version
that asks for a permission or a host no approved version had, or adds
`backend.wasm` for the first time, waits for a moderator. Until it is released
nobody but you and the moderators can see it.

## Updates

The launcher checks for updates when it starts and from Settings → Addons. An
update goes through the same window as the first install; if it asks for more, the
player sees what is new before agreeing.

## Taken down

If moderation removes an addon, the launcher turns it off the next time it starts
and tells the player why. It cannot be turned back on, only uninstalled.
