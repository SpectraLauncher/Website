// A stable address that survives a project changing its type or its slug.
export default defineEventHandler(event =>
  redirectToProject(event, String(getRouterParam(event, 'id') ?? '')))
