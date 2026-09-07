import type { ProjectInput } from '../../../utils/catalog'

// What an author may change about their own project. Deliberately a list rather
// than the whole body: updateProject also takes `status`, and an author setting
// that would be publishing without review.
export const DETAILS = [
  'title', 'summary', 'slug', 'license', 'licenseUrl', 'links',
  'categories', 'featuredCategories', 'environment', 'visibility', 'price', 'currency',
] as const

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event) ?? {}

  // The body is the only thing edit_body covers, and somebody may hold that
  // without edit_details — a translator, say. Two guards, one route.
  const wantsBody = 'description' in body
  const wantsDetails = DETAILS.some(key => key in body)

  const { project } = await editableProject(event, wantsDetails ? 'edit_details' : 'edit_body')
  if (wantsBody && wantsDetails) {
    await editableProject(event, 'edit_body')
  }

  const input: ProjectInput = {}
  for (const key of DETAILS) {
    if (wantsDetails && key in body) (input as Record<string, unknown>)[key] = body[key]
  }
  if (wantsBody) input.description = body.description

  const updated = await updateProject(project.id, input)

  return { project: fullProject(updated, [], []) }
})
