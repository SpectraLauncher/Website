Every project has a type, and the type decides where it appears and what
metadata it carries.

| Type | What it is | What decides compatibility |
| --- | --- | --- |
| Mod | Changes or extends the game | Loader plus game versions |
| Plugin | Runs on a server, not on a client | Server platform plus game versions |
| Modpack | A curated set of mods | Loader, game version and the mod list |
| Shader | Changes how the game is drawn | Iris, OptiFine or Canvas |
| Resource pack | Textures, sounds, models | Pack format |
| Schematic | A building to paste into a world | Game version and file format |

## A project can be in more than one list

Compatibility comes from the loaders a project declares, not only from its type.
A jar built for both Fabric and Paper appears under mods **and** under plugins,
because that is what it actually is.

## Environment

A mod or plugin says whether it is needed on the client, on the server, or on
both. That is what the environment filter searches.
