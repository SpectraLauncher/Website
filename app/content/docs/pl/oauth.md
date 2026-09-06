Jeśli budujesz coś, do czego będą logować się inni ludzie, zarejestruj to jako
aplikację, zamiast prosić ich o token.

## Rejestracja

**Ustawienia → Aplikacje**. Potrzebujesz:

- **Nazwy**, którą zobaczą ludzie proszeni o zgodę
- **Adresów powrotu** — dokąd wraca przeglądarka. Tylko https, poza localhostem,
  żeby aplikacja na komputer miała gdzie nasłuchiwać
- **Maksimum, o jakie kiedykolwiek może prosić** — sufit zakresów
- **Ważności tokenu**

Dostajesz identyfikator klienta i sekret. Sekret pokazujemy raz i można go
wymienić bez rejestrowania czegokolwiek od nowa.

## Przepływ

1. Wyślij osobę na `/oauth/authorize` z `client_id`, `redirect_uri`, żądanym
   `scope` i własnym `state`
2. Widzi, o co prosisz i na jak długo, i zgadza się albo odmawia
3. Wraca na twój adres z `code` i twoim `state`
4. Wymień kod pod `/api/oauth/token`, podając sekret klienta

## Zasady, które warto znać przed debugowaniem

- Adres powrotu musi być jednym z zarejestrowanych — schemat, host, port i
  ścieżka muszą się zgadzać. Różnić może się tylko query
- Kod działa dziesięć minut, raz, i tylko dla adresu, dla którego powstał
- Każda nieudana wymiana odpowiada tak samo, więc nie odróżnisz wygasłego od już
  użytego ani od złego klienta. Tak ma być

## Cofnięcie dostępu

Ludzie cofają go w **Ustawienia → Aplikacje**, a to kasuje także tokeny. Nie
zakładaj, że token działa aż do wygaśnięcia.
