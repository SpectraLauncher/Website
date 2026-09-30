Każdy projekt ma typ, a typ decyduje, gdzie się pojawia i jakie niesie metadane.

| Typ | Czym jest | Co decyduje o zgodności |
| --- | --- | --- |
| Mod | Zmienia lub rozszerza grę | Loader i wersje gry |
| Plugin | Działa na serwerze, nie u gracza | Platforma serwerowa i wersje gry |
| Modpack | Dobrany zestaw modów | Loader, wersja gry i lista modów |
| Shader | Zmienia sposób rysowania gry | Iris, OptiFine albo Canvas |
| Resourcepack | Tekstury, dźwięki, modele | Format paczki |
| Schemat | Budowla do wklejenia w świat | Wersja gry i format pliku |

## Projekt może być na kilku listach

Zgodność wynika z loaderów, które projekt deklaruje, a nie tylko z jego typu. Jar
zbudowany i pod Fabrica, i pod Papera pojawi się wśród modów **oraz** wśród
pluginów, bo tym właśnie jest.

## Środowisko

Mod albo plugin mówi, czy jest potrzebny u gracza, na serwerze, czy po obu
stronach. Tego szuka filtr środowiska.
