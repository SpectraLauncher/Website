export function humanDuration(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))

  if (value < 60) return `${value} s`

  const minutes = Math.round(value / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function timeAgo(ms: number, locale: string): string {
  const diff = Date.now() - ms
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000]
  ]

  for (const [unit, size] of units) {
    if (diff >= size) return rtf.format(-Math.floor(diff / size), unit)
  }

  return rtf.format(0, 'minute')
}
