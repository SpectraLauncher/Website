import type { H3Event } from 'h3'

/**
 * Send /project/<id> to wherever that project actually lives.
 *
 * A real HTTP 301 from the server rather than a Vue page that fetches and then
 * calls navigateTo: a crawler gets the redirect without running any JavaScript,
 * and the address is resolved before a page is ever rendered.
 *
 * Visibility goes through the same check the project endpoint uses, so an
 * address nobody may open answers 404 instead of leaking the slug through a
 * Location header.
 */
export async function redirectToProject(event: H3Event, id: string, prefix = '') {
  const viewer = await requireCatalogRead(event)

  const project = await projectByIdOrSlug(id)
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  return await sendRedirect(event, `${prefix}${projectPath(project!.type, project!.slug)}`, 301)
}
