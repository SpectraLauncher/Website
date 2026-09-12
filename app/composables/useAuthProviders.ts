/**
 * Which sign-in providers this deployment has configured.
 *
 * The sign-in page and the account's security tab both ask, and before this they
 * asked under two different keys — so the same answer was fetched twice in one
 * session. One key, one request.
 */
export function useAuthProviders() {
  return useFetch<{ providers: string[], turnstileSiteKey: string }>('/api/auth-providers', {
    key: dataKeys.authProviders(),
  })
}
