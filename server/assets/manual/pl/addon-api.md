Każda strona, zakładka instancji, okno, ekran ustawień i `main.js` dostaje
`window.spectra`, zanim wykona się jej pierwszy skrypt. Każda metoda zwraca
promise. Wywołanie, na które addon nie ma uprawnienia, kończy się błędem z `code`
równym `permission_denied`.

```js
const instances = await spectra.instances.list()
await spectra.ui.toast(`${instances.length} instances`, { color: 'success' })
```

## Kontekst

`spectra.context` zawiera to, co launcher przekazał stronie. Zakładka instancji
dostaje `instanceId`.

## instances

| Metoda | Uprawnienie | Wynik |
|---|---|---|
| `list()` | `instances:read` | Wszystkie instancje: `id`, `name`, `mcVersion`, `loader`, `group`, `memoryMb`, `createdAt`, `lastPlayed`, `playtimeSeconds` |
| `get(id)` | `instances:read` | Jedna instancja |
| `content(id, kind)` | `instances:read` | Pliki rodzaju `kind` (`mod`, `resourcepack`, `shader` albo `datapack`), każdy z `filename`, `enabled`, `name` i `version` |
| `worlds(id)` | `instances:read` | Światy instancji |
| `isRunning(id)` | `instances:read` | `true`, dopóki gra działa |
| `update(id, { name, memoryMb, group })` | `instances:write` | Zmieniona instancja. `memoryMb` 512–65536, `group: null` usuwa grupę |
| `setContentEnabled(id, kind, filename, enabled)` | `instances:write` | Włącza albo wyłącza jeden plik |
| `launch(id)` | `instances:launch` | Uruchamia grę |
| `stop(id)` | `instances:launch` | Zatrzymuje ją |

## logs

| Metoda | Uprawnienie | Wynik |
|---|---|---|
| `console(id, cursor)` | `logs:read` | `{ lines, cursor, reset }`: linie konsoli od `cursor`. Następnym razem podaj zwrócony `cursor` |
| `list(id)` | `logs:read` | Pliki logów instancji |
| `read(id, rel)` | `logs:read` | Treść jednego pliku logu |

## servers, account, skins

| Metoda | Uprawnienie | Wynik |
|---|---|---|
| `servers.ping(host, port)` | `servers:ping` | `{ online, max, latency_ms, version, protocol, motd, favicon }`. Domyślny port to 25565 |
| `account.minecraft()` | `account:read` | `{ uuid, username, kind }` albo `null` |
| `account.spectra()` | `account:read` | `{ username, name, image }` albo `null` |
| `skins.list()` | `skins:read` | Zapisane skiny |

## http

```js
const response = await spectra.http.fetch('https://api.example.com/status', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hello: 'world' }),
})
// { status, ok, contentType, body }
```

- tylko `https`, tylko do hostów wpisanych jako `network:<host>`, także przy
  przekierowaniach
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE` i `HEAD`
- treść żądania to tekst do 1 MB, odpowiedź do 10 MB, łącznie 15 sekund
- nagłówki `Cookie`, `Origin`, `Referer`, `Host`, `User-Agent` i nagłówki
  połączenia są pomijane

## storage

Pamięć wartości JSON tylko dla tego addonu, łącznie do 5 MB. Znika razem z
odinstalowaniem addonu.

| Metoda | Wynik |
|---|---|
| `get(key)` | Wartość albo `null` |
| `set(key, value)` | Zapisuje dowolną wartość JSON |
| `remove(key)` | Usuwa ją |
| `keys()` | Wszystkie klucze |

## ui

| Metoda | Wynik |
|---|---|
| `toast(title, { description, color })` | Powiadomienie. `color`: `success`, `info`, `warning`, `error` |
| `navigate(page)` | Otwiera jedną ze stron addonu |
| `openWindow(window)` | Otwiera jedno z okien addonu |
| `openUrl(url)` | Pyta gracza, potem otwiera link `https`. Zwraca, czy został otwarty |
| `confirm(message)` | Pyta gracza. Zwraca `true` albo `false` |

## launcher

| Metoda | Wynik |
|---|---|
| `version()` | Wersja launchera, na przykład `1.0.0` |
| `locale()` | Język launchera, na przykład `pl` |
| `theme()` | `{ mode, accent }` bieżącego motywu |

## backend

`spectra.backend.call(fn, input)` uruchamia funkcję z `backend.wasm` z `input`
jako JSON i zwraca jej wynik, sparsowany, jeśli to JSON.

## events

`spectra.events.on(name, handler)` zwraca funkcję, która kończy nasłuchiwanie.

| Zdarzenie | Dane |
|---|---|
| `game:launch` | `{ instanceId }` |
| `game:exit` | `{ instanceId, code }` |
| `instance:created` | `{ instanceId }` |
| `instance:removed` | `{ instanceId }` |

## commands

`spectra.commands.register(name, handler)` w `main.js` tworzy komendę dla
przycisków z akcją `command`. Funkcja dostaje `{ instanceId }`, gdy przycisk jest
przy instancji.

```js
spectra.commands.register('show-name', async ({ instanceId }) => {
  const instance = await spectra.instances.get(instanceId)
  await spectra.ui.toast(instance.name)
})
```

## Co strona może wczytać

Skrypty, style, obrazy, czcionki i media tylko z własnych plików addonu, do tego
wstawione `<script>` i `<style>` oraz obrazy `data:` i `blob:`. Inne strony, ramki,
workery i wysyłanie formularzy są zablokowane. Do własnych plików odwołuj się
ścieżkami względnymi, na przykład `style.css` obok strony.
