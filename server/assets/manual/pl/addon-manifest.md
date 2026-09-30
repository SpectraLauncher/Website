Każdy addon to `.zip` z plikiem `addon.json` na samej górze archiwum. Launcher i ta
strona czytają ten sam plik według tych samych zasad, więc addon, który da się tu
wgrać, zainstaluje się w launcherze.

## Przykład

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

## Pola

| Pole | Wymagane | Znaczenie |
|---|---|---|
| `id` | tak | Do 64 znaków: `a-z`, `0-9` i myślniki, nie na początku ani na końcu. Identyfikuje addon i nie może się zmienić po opublikowaniu pierwszej wersji |
| `name` | tak | Do 64 znaków |
| `version` | tak | Litery, cyfry, kropki, myślniki i `+`, do 60 znaków. Strona bierze numer wersji właśnie stąd |
| `api` | tak | Wersja API addonów. Obecnie `1` |
| `description` | nie | Do 400 znaków |
| `launcher` | nie | Wersje launchera, z którymi addon działa, jako zakres: `>=1.0.0`, `^1.2`, `>=1.0.0, <2.0.0`. Bez tego pola addon działa na każdej wersji. Strona pokazuje ten zakres przy każdej wersji |
| `main` | nie | Plik `.js` albo `.mjs`, który działa w tle, dopóki addon jest włączony |
| `backend` | nie | Plik `.wasm`, opisany na stronie Backend |
| `permissions` | nie | Na co addon ma pozwolenie, do 30 pozycji |
| `contributes` | nie | Wszystko, co addon dokłada do launchera |

Addon musi coś dodawać: `main`, `backend` albo co najmniej jedną pozycję w
`contributes`. Ścieżki liczą się od korzenia archiwum i używają `/`.

## Uprawnienia

| Uprawnienie | Pozwala |
|---|---|
| `instances:read` | Wypisać instancje, ich zawartość i światy |
| `instances:write` | Zmieniać nazwę, pamięć i grupę instancji, włączać i wyłączać zawartość |
| `instances:launch` | Uruchamiać i zatrzymywać grę |
| `logs:read` | Czytać konsolę gry i pliki logów |
| `servers:ping` | Sprawdzać serwery Minecrafta |
| `account:read` | Nazwy konta Minecraft i konta Spectra |
| `skins:read` | Zapisane skiny |
| `resourcepacks:read` | Wypisywanie plików w paczce zasobów i czytanie ich |
| `resourcepacks:write` | Zapisywanie edytowanej kopii paczki zasobów |
| `files:read:<folder>` | Czytanie jednego folderu (albo pliku) na górze folderu gry instancji, na przykład `files:read:config` albo `files:read:options.txt` |
| `files:write:<folder>` | Także tworzenie, zmiana i usuwanie tam plików, na przykład `files:write:saves`. Do `mods`, `kubejs`, `scripts` i `coremods` nie da się pisać, tak samo jak nigdzie nie da się zapisać plików programów, takich jak `.jar`, `.dll` czy `.exe` |
| `network:<host>` | `spectra.http.fetch` dokładnie do tego hosta przez `https`, na przykład `network:api.example.com` |

Pamięć addonu, powiadomienia, własne strony i okna addonu oraz wersja, język i motyw
launchera nie wymagają uprawnień.

## contributes

### pages, instanceTabs

Listy `{ "id", "title", "entry", "icon" }`. `entry` to plik `.html`, a `icon`
opcjonalny `.svg`, `.png` albo `.webp`. Stronę otwiera przycisk albo
`spectra.ui.navigate`. Zakładka instancji pojawia się na stronie każdej instancji i
dostaje ją w `spectra.context.instanceId`.

### settings

Plik `.html` pokazywany pod addonem w Ustawienia → Addony.

### windows

Lista `{ "id", "title", "entry", "width", "height", "resizable" }`. Szerokość
200–3840 i wysokość 150–2160, obie opcjonalne (domyślnie 800 × 600). `resizable`
jest `true`, chyba że ustawisz `false`. Tytuł okna to zwykły tekst, nie jest
tłumaczony.

### buttons

Lista `{ "id", "slot", "title", "icon", "action" }`. `slot` to jedno z miejsc
wymienionych na stronie Addony. Akcja to jedna z:

| Akcja | Robi |
|---|---|
| `{ "type": "url", "url": "https://…" }` | Otwiera link w przeglądarce |
| `{ "type": "page", "page": "<id strony>" }` | Otwiera jedną ze stron addonu |
| `{ "type": "window", "window": "<id okna>" }` | Otwiera jedno z okien addonu |
| `{ "type": "command", "command": "<nazwa>" }` | Uruchamia komendę zarejestrowaną w `main.js`, więc wymaga `main` |

Komenda uruchomiona z `instance.menu` albo `instance.header` dostaje `{ instanceId }`.

### themes

Lista `{ "id", "name", "file" }`, gdzie `file` to `.json`:

```json
{ "mode": "oled", "accent": "violet", "background": "themes/night.png" }
```

- `mode`: `dark`, `oled` albo `squared`
- `accent`: `sky`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`, `red`,
  `orange`, `amber`, `green`, `emerald`, `teal` albo `cyan`
- `background`: plik `.png`, `.jpg` albo `.webp` z archiwum

Wszystkie trzy są opcjonalne. Motyw gracz wybiera w Ustawieniach.

### locales

`{ "en": "locales/en.json", "pl": "locales/pl.json" }`. Każdy plik mapuje klucze na
teksty. Tytuł zapisany jako `%klucz%` w `addon.json` pokazuje tekst w języku
launchera, potem po angielsku, a na końcu sam klucz. Do 500 kluczy w pliku, do 500
znaków w tekście.

## Limity

- do 20 pozycji w każdej liście i 30 uprawnień
- archiwum do 100 MB i 2000 plików, bez ścieżek wychodzących poza nie
- pliki JSON do 1 MB
