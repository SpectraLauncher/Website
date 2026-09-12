/**
 * Mark cached data stale after a write.
 *
 * A thin pass over refreshNuxtData, which is Nuxt's own invalidation — the point
 * of the wrapper is that it takes the builders from dataKeys, so a refresh
 * cannot quietly name a key nothing uses.
 */
export function useInvalidate() {
  /** Refetch now, for anything currently mounted. */
  const invalidate = (...keys: Array<string | string[]>) =>
    refreshNuxtData(keys.flat())

  /**
   * Throw the payload away instead of refetching.
   *
   * For data that belongs to whoever was signed in: after signing out, a
   * refresh would ask again as a stranger and cache the stranger's answer.
   */
  const forget = (...keys: Array<string | string[]>) =>
    clearNuxtData(keys.flat())

  return { invalidate, forget }
}
