Cztery kompletne addony na start. Każdy instaluje się bez zmian: wczytaj go w trybie
dewelopera, rozejrzyj się, a potem zmień `id` w `addon.json` i zrób z niego swój.
Każde archiwum ma `README.md`, które opisuje jego pliki.

| Szablon | Co pokazuje | Pobierz |
|---|---|---|
| Motyw | Motyw z własnym tłem, tłumaczenia i link na ekranie głównym. Bez kodu | [spectra-addon-theme.zip](/api/catalog/addon-templates/theme) |
| Strony | Strona w lewym pasku, zakładka na każdej instancji, ekran ustawień, komenda w menu instancji i reakcja na zamknięcie gry | [spectra-addon-page.zip](/api/catalog/addon-templates/page) |
| Okno | Przycisk w pasku tytułu, który otwiera własne okno, sprawdza serwery Minecrafta i pobiera dane z jednego dozwolonego hosta | [spectra-addon-window.zip](/api/catalog/addon-templates/window) |
| Backend | Strona, która oddaje pracę do `backend.wasm`, razem z kodem w Rust i instrukcją budowania | [spectra-addon-backend.zip](/api/catalog/addon-templates/backend) |

Wszystkie cztery mają `"launcher": ">=1.0.0"`, bo addony pojawiają się w launcherze
1.0.0. Podnieś ten zakres w `addon.json`, gdy addon potrzebuje czegoś, co dodał
nowszy launcher.
