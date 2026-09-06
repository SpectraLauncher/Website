
// Turns a lifetime in days into words. Zero is "never", which is why this is not
// just a number followed by a unit.
export function useLifetimeLabel() {
  const { t } = useI18n()

  return (days: number) =>
    t(days > 0 ? `tokens.lifetimes.${days}` : 'tokens.lifetimes.never')
}
