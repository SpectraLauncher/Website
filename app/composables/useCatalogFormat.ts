// The three numbers every catalog listing prints. They were formatted inline in
// each page before, which is how a euro price ended up divided by 100 in seven
// places and a date rendered in a different locale in two of them.
export function useCatalogFormat() {
  const { t, locale } = useI18n()

  const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

  const when = (ms: number) =>
    new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

  // Prices are stored in euro cents (shared/utils/catalog-types.ts), and zero
  // means free rather than "€0.00".
  const price = (minor: number) => (minor > 0
    ? new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' }).format(minor / 100)
    : t('catalog.free'))

  return { count, when, price }
}
