
import type { H3Event } from 'h3'

// Jedna flaga na caly katalog. Dopoki jest wylaczona, kazda trasa katalogu —
// strona, API publiczne i API zgodne z Modrinthem — istnieje wylacznie dla
// admina i odpowiada 404 wszystkim pozostalym. Otwarcie na swiat to zmiana
// CATALOG_PUBLIC na 'true', a nie polowanie na warunki po plikach.
// Porownanie jest jawne, bo Boolean('false') to true, a ta flaga trzyma bramy
// calego katalogu — przypadkowy string musi ja zostawiac zamknieta.
export function catalogIsPublic(): boolean {
  const value = useRuntimeConfig().catalogPublic
  return value === true || value === 'true'
}

// Odczyt katalogu. Zwraca zalogowanego uzytkownika albo null, gdy katalog jest
// juz publiczny — wtedy anonim tez ma prawo czytac.
export async function requireCatalogRead(event: H3Event) {
  if (catalogIsPublic()) return await optionalUser(event)
  return await requireAdmin(event)
}

// Zapis do katalogu. Zostaje adminowy nawet po otwarciu odczytu — otwarty upload
// wchodzi razem z moderacja, osobna decyzja i osobny etap.
export async function requireCatalogWrite(event: H3Event) {
  return await requireAdmin(event)
}

// Czy tresc katalogu moze wyciec do sitemapy, llms.txt, feedow i publicznych
// listingow. Osobna nazwa od catalogIsPublic, bo to jest inne pytanie zadawane
// w innym miejscu i chce, zeby grep po nim cos znajdowal.
export function catalogIsIndexable(): boolean {
  return catalogIsPublic()
}
