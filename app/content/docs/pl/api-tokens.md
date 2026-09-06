Token osobisty pozwala skryptowi działać w twoim imieniu, bez twojego hasła i
bez twojej sesji.

## Tworzenie

**Ustawienia → Tokeny API**. Nadaj nazwę, wybierz, jak długo ma żyć, i zaznacz
potrzebne zakresy.

Token pokazujemy raz. Nie da się go zobaczyć ponownie — przechowujemy tylko hash,
tak samo jak przy haśle — więc skopiuj go, zanim opuścisz stronę.

## Zakresy

Token może tylko to, co zaznaczyłeś. Wybór zakresu zapisu automatycznie daje
odczyt, bo token, który może coś zmienić, oczywiście może to zobaczyć.

Dwóch rzeczy token nie zrobi nigdy, cokolwiek zaznaczysz: nie utworzy kolejnego
tokenu i nie zamknie twojego konta. Wąski wyciek nie może sam się poszerzyć.

## Ważność

Dzień, tydzień, dwa tygodnie, miesiąc, dziewięćdziesiąt dni, rok, dwa lata albo
nigdy. Wybierz najkrótszą, która pasuje do tego, co budujesz.

## Użycie

Wyślij go jako token bearer:

```
Authorization: Bearer spx_twoj_token
```

## Jeśli wycieknie

Unieważnij go z tej samej strony. Unieważnienie działa natychmiast.
