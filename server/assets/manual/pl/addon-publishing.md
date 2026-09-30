## Najpierw wypróbuj

Włącz tryb dewelopera w launcherze, w Ustawienia → Addony, i wczytaj folder addonu
albo `.zip`. Folder można przeładować po każdej zmianie przyciskiem obok niego. Tak
wczytany addon jest oznaczony jako niezweryfikowany i prosi o te same uprawnienia co
opublikowany.

## Spakuj

Spakuj zawartość folderu addonu tak, żeby `addon.json` leżał na samej górze
archiwum, a nie w kolejnym folderze. Pomiń to, czego nie wydajesz, na przykład
`node_modules` albo `target` z Rusta.

## Załóż projekt

**Nowy projekt** na tej stronie, typ **Addon**:

1. **Licencja.** Wymagana. Otwarta licencja (MIT, Apache, GPL i podobne) wymaga też
   linku do kodu źródłowego na GitHubie, GitLabie albo Codebergu.
2. **Opis.** Opis skrócony, pełny opis, kategorie i ikona.
3. **Pierwsza wersja.** Wgraj `.zip`. Strona czyta `addon.json` i uzupełnia numer
   wersji oraz zakres wersji launchera; nie da się ich wpisać ręcznie, więc zmieniaj
   je w `addon.json`. `id` addonu jest od teraz stałe: kolejna wersja z innym `id`
   zostanie odrzucona.
4. **Akceptacja.** Wyślij projekt do moderacji.

## Przegląd

Moderator ogląda addon raz, z listą kontrolną:

- czy każde uprawnienie jest potrzebne do tego, co addon obiecuje
- czy każdy host, z którym się łączy, do tego pasuje
- czy kod jest czytelny, a nie zaciemniony albo ściśnięty w jedną linię
- czy `backend.wasm`, jeśli jest, ma opisany cel i rozsądny rozmiar

Po akceptacji nowe wersje wchodzą od razu, z jednym wyjątkiem: wersja, która prosi o
uprawnienie albo host, którego nie miała żadna zatwierdzona wersja, albo pierwszy raz
dokłada `backend.wasm`, czeka na moderatora. Dopóki nie zostanie wypuszczona, widzisz
ją tylko ty i moderacja.

## Aktualizacje

Launcher sprawdza aktualizacje przy starcie i w Ustawienia → Addony. Aktualizacja
przechodzi przez to samo okno co pierwsza instalacja; jeśli prosi o więcej, gracz
widzi, co doszło, zanim się zgodzi.

## Zdjęcie addonu

Jeśli moderacja usunie addon, launcher wyłączy go przy następnym starcie i powie
graczowi dlaczego. Nie da się go włączyć ponownie, można go tylko odinstalować.
