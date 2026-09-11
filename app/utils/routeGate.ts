/**
 * A route middleware that asks the server whether this page may be opened at
 * all, and turns the answer into the two outcomes a visitor should ever see.
 *
 * The distinction matters and is easy to get wrong by hand: 401 means "we do
 * not know who you are", so it sends you to sign in and brings you back.
 * Anything else becomes a 404 — never a 403, because a 403 confirms the page
 * exists, and while the catalog and the admin area are closed the whole point
 * is that they do not appear to.
 *
 * Both gates were copies of each other before this, which is one edit away from
 * two gates that disagree.
 *
 * To add one: a middleware of three lines pointing at an endpoint that answers
 * 401 or 404, and a server guard that really does answer that way.
 */
export function gateRoute(endpoint: string) {
  return defineNuxtRouteMiddleware(async (to) => {
    const localePath = useLocalePath()

    try {
      await $fetch(endpoint, {
        // During SSR a plain $fetch carries no cookies, so the gate would judge
        // a signed-in visitor as a stranger and bounce them to sign in.
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
      })
    }
    catch (e) {
      const status = (e as { statusCode?: number, status?: number }).statusCode
        ?? (e as { status?: number }).status
        ?? 404

      if (status === 401) {
        return navigateTo({ path: localePath('/login'), query: { next: to.fullPath } })
      }

      throw createError({ statusCode: 404, fatal: true })
    }
  })
}
