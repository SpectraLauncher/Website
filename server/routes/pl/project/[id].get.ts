// The non-default locale is prefixed, so the twin has to be named too — the same
// reason the static redirects in nuxt.config list both.
export default defineEventHandler(event =>
  redirectToProject(event, String(getRouterParam(event, 'id') ?? ''), '/pl'))
