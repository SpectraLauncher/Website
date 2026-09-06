Zapytania są limitowane na adres, żeby jeden ruchliwy klient nie zepsuł serwisu
wszystkim pozostałym.

## Czego się spodziewać

Po przekroczeniu limitu dostajesz **429** z nagłówkiem `retry-after`, który mówi,
ile sekund czekać. Uszanuj go — ponowienie od razu tylko zjada następne okno.

Budżety różnią się między endpointami. Odczyt jest hojny, zapis ciaśniejszy, a
wszystko, co wysyła maile albo dociera do każdego moderatora, jeszcze ciaśniejsze.

## Jak napisać porządnego klienta

- Czytaj `retry-after`, zamiast zgadywać
- Wycofuj się, zamiast ponawiać w pętli
- Buforuj to, co się nie zmienia. Dane projektów i wersji niosą ETag, więc
  zapytanie warunkowe kosztuje prawie nic, gdy nic się nie ruszyło
- Proś o to, czego potrzebujesz. Wyszukanie pliku po hashu bije pobieranie listy

## Zapytania zbiorcze

Launchery rozpoznają nieznane pliki po hashu. Jest endpoint pozwalający sprawdzić
wiele hashy naraz i jest znacznie uprzejmiejszy niż zapytanie na plik.
