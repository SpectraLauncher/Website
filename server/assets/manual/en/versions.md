A version is a release of your project. It carries a number, a changelog, a
release channel, the game versions and loaders it works with, and one or more
files.

## Numbers

Version numbers are yours to choose, but they have to be unique within the
project. Most people follow the mod's own versioning.

## Channels

- **Release** — ready for anyone
- **Beta** — works, but expect rough edges
- **Alpha** — early, may break

Listings default to releases.

## Files

Upload the jar, the zip, or the schematic. We compute both a SHA-1 and a SHA-512
for every file: SHA-1 because the Minecraft ecosystem identifies files that way
and launchers need it, SHA-512 because SHA-1 is broken and should not decide
where anything is stored.

Metadata is read out of the file itself — `fabric.mod.json`, `mods.toml`,
`plugin.yml`, `pack.mcmeta`, the schematic's NBT — rather than trusted from the
form. If a jar carries descriptors for several platforms, all of them are read.

## Scanning

Every uploaded archive is examined for things that have no business being in it:
executables, path traversal, compression bombs, addresses that serve arbitrary
files, and known malware markers. A flagged file stops the project from being
published until a person has looked.

The scan raises a hand. It does not make the decision.

## Dependencies

A version can require, recommend, embed, or declare itself incompatible with
another project or a specific version of one.
