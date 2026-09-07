# Test fixtures

Real archives the parsers are tested against. They are not in the repository:
together they are tens of megabytes of other people's builds, and redistributing
them is not ours to do.

Without them `vitest` skips the suites that need them and says so. Drop the files
in here to get that coverage back.

| file | what it is | where it came from |
|---|---|---|
| `Jade-1.20.1-Forge-11.13.3.jar` | Forge mod | Jade, any 1.20.1 Forge build |
| `Jade-1.21.1-NeoForge-15.10.6.jar` | NeoForge mod | Jade, any 1.21.1 NeoForge build |
| `Jade-mc26.1-Fabric-26.1.9.jar` | Fabric mod | Jade, any recent Fabric build |
| `veinminer-paper-2.12.1.jar` | Paper plugin | VeinMiner |
| `worldedit-bukkit-7.4.5.jar` | Bukkit plugin, ships a nested zip | WorldEdit |
| `TAB v6.1.2.jar` | multi-platform plugin | TAB |
| `Better-Leaves-9.5.zip` | resource pack | Better Leaves |
| `ComplementaryReimagined_r5.9.zip` | shader pack | Complementary Reimagined |
| `swamp_house.nbt` | structure block | any saved structure |
| `swamp_house.litematic` | Litematica schematic | any saved schematic |
| `swamp_house.schem` | Sponge schematic | WorldEdit export |
| `swamp_house.schematic` | legacy MCEdit schematic | WorldEdit export |

The small ones are ours and are written by `test/fixtures/make.mjs`:
`sample-fabric-mod.jar`, `sample-plugin.jar`, `sample-velocity-plugin.jar`,
`sample-pack.mrpack`, `scan-beacon.jar`, `scan-disguised.jar`,
`scan-executable.jar`, `zip-bomb.zip`, `zip-comment.zip`, `zip-traversal.zip`.
