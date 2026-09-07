import type { ProjectInput } from '../../utils/catalog'

// The author-facing way to start a project. The admin route next to it takes a
// whole project at once; this one takes only what the create form asks for, and
// everything else is filled in afterwards on the project page.
export default defineEventHandler(async (event) => {
  const user = await requireCatalogWrite(event)

  const body = await readBody<{
    title?: unknown
    slug?: unknown
    type?: unknown
    orgId?: unknown
    visibility?: unknown
    summary?: unknown
    authorship?: unknown
  }>(event) ?? {}

  rateLimit(event, { key: `create-project:${user.id}`, limit: 10, windowMs: 3_600_000 })

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : ''

  // An organization project counts against the organization, so a personal
  // ceiling only applies when the account itself will own it.
  if (!orgId) {
    await requireHeadroom(user.id, 'projects')
  }
  else {
    // 404 rather than 403: an organization the caller is not in should not be
    // confirmed to exist by the way this answers.
    const standing = await orgStanding(orgId, user)
    if (!standing || !(standing.mask & ORG_PERMISSIONS.add_project)) {
      throw createError({ statusCode: 404, statusMessage: 'no such organization' })
    }
  }

  const input: ProjectInput = {
    title: body.title,
    slug: body.slug,
    type: body.type,
    summary: body.summary,
    orgId: orgId || undefined,
    visibility: body.visibility,
    authorship: body.authorship,
  }

  const project = await createProject(input, user.id)

  setResponseStatus(event, 201)
  return { project: fullProject(project, [], []) }
})
