Addon zmienia launcher Spectra: dokłada motyw, przycisk, stronę, całe okno albo
zadanie działające w tle. Addony publikuje się tutaj, a instaluje z launchera, od
wersji 1.0.0. Każdy działa w piaskownicy, która pozwala mu tylko na to, o co
poprosił.

## Co addon może dodać

| Element | Co to jest | Kod |
|---|---|---|
| Motywy | Tryb, kolor akcentu i obraz tła | brak |
| Tłumaczenia | Nazwy wszystkiego, co addon dodaje, w każdym języku | brak |
| Przyciski | Linki, strony, okna albo komendy umieszczone w launcherze | brak, poza komendami |
| Strony | Pełne ekrany w launcherze, otwierane przyciskiem | HTML, CSS, JavaScript |
| Zakładki instancji | Zakładka na stronie każdej instancji | HTML, CSS, JavaScript |
| Ustawienia | Ekran w Ustawienia → Addony | HTML, CSS, JavaScript |
| Okna | Osobne okna launchera | HTML, CSS, JavaScript |
| Skrypt w tle | `main.js`, działa, dopóki addon jest włączony | JavaScript |
| Backend | `backend.wasm`, do cięższej pracy | wszystko, co kompiluje się do WebAssembly |

## Gdzie trafiają przyciski

| Slot | Miejsce w launcherze |
|---|---|
| `sidebar.menu` | Lewy pasek, obok Home i Worlds |
| `sidebar.footer` | Dół lewego paska |
| `titlebar` | Pasek tytułu okna |
| `home.header` | Góra ekranu głównego |
| `instance.header` | Góra strony instancji |
| `instance.menu` | Menu instancji na ekranie głównym |
| `worlds.header` | Góra strony światów |
| `screenshots.header` | Góra strony zrzutów ekranu |
| `skins.header` | Góra strony skinów |
| `settings.header` | Góra ustawień |

## Języki

Strony, zakładki, ustawienia i okna to zwykły HTML, CSS i JavaScript. Framework nie
jest potrzebny, a to, czy coś budujesz, zależy od ciebie: launcher potrzebuje tylko
plików.

Backend to WebAssembly zbudowany zestawem [Extism](https://extism.org), więc można
go napisać w Rust, Go, C, Zig, AssemblyScript, C# i innych językach, które Extism
obsługuje.

## Piaskownica

Kod addonu nigdy nie działa wewnątrz samego launchera.

- Każda strona, zakładka, okno, ekran ustawień i `main.js` działa w odizolowanej
  ramce serwowanej z osobnego adresu. Nie sięga do wnętrza launchera ani do jego
  komend.
- Jedyne wyjście to `window.spectra`, a każde wywołanie jest sprawdzane z
  uprawnieniami w `addon.json`.
- Strona nie wczyta skryptów z internetu, nie wywoła `fetch` bezpośrednio i nie
  otworzy innych stron. Sieć idzie przez `spectra.http.fetch`, tylko przez `https`
  i tylko do hostów, które addon wymienił.
- `backend.wasm` nie ma plików, zegara ani sieci. Do launchera sięga przez te same
  uprawnienia.

Przed instalacją launcher pokazuje graczowi, o co addon prosi. Aktualizacja, która
prosi o więcej, pokazuje, co doszło, i pyta ponownie.

## Instalacja

- Ze strony: **Zainstaluj w Spectra** na stronie addonu otwiera launcher.
- Z launchera: Ustawienia → Addony pokazują opublikowane addony.
- W trakcie pracy: włącz tryb dewelopera w Ustawienia → Addony i wczytaj folder
  albo `.zip`. Tak wczytany addon jest oznaczony jako niezweryfikowany.

Najszybciej zacząć od jednego z szablonów.
