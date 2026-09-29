// The numbers every catalog listing prints. They were formatted inline in each
// page before, which is how a date rendered in a different locale in two of them.
export function useCatalogFormat() {
  const { locale } = useI18n()

  const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

  const when = (ms: number) =>
    new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

  return { count, when }
}
