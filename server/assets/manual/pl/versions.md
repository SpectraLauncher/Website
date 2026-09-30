Wersja to wydanie twojego projektu. Niesie numer, changelog, kanał wydania,
wersje gry i loadery, z którymi działa, oraz jeden lub więcej plików.

## Numery

Numery wersji wybierasz sam, ale muszą być unikalne w obrębie projektu.
Najczęściej trzyma się wersjonowania samego moda.

## Kanały

- **Release** — gotowe dla każdego
- **Beta** — działa, ale spodziewaj się chropowatości
- **Alpha** — wczesne, może się psuć

Listy domyślnie pokazują wydania stabilne.

## Pliki

Wgraj jar, zip albo schemat. Dla każdego pliku liczymy **SHA-1 i SHA-512**:
SHA-1, bo tak identyfikuje pliki cały ekosystem Minecrafta i launchery tego
potrzebują; SHA-512, bo SHA-1 jest złamany i nie powinien decydować, gdzie
cokolwiek leży.

Metadane czytamy z samego pliku — `fabric.mod.json`, `mods.toml`, `plugin.yml`,
`pack.mcmeta`, NBT schematu — zamiast wierzyć formularzowi. Jeśli jar niesie
deskryptory kilku platform, czytamy wszystkie.

## Skanowanie

Każde wgrane archiwum jest sprawdzane pod kątem rzeczy, których nie ma prawa
zawierać: plików wykonywalnych, wyjścia poza katalog, bomb kompresyjnych, adresów
serwujących dowolne pliki i znanych markerów złośliwego kodu. Oflagowany plik
wstrzymuje publikację, dopóki nie spojrzy na niego człowiek.

Skaner podnosi rękę. Nie podejmuje decyzji.

## Zależności

Wersja może wymagać innego projektu, polecać go, osadzać w sobie albo deklarować
niezgodność — wobec całego projektu lub konkretnej wersji.
