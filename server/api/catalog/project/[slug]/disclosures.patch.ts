export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_details')

  const body = await readBody<{ disclosures?: unknown }>(event) ?? {}

  // mergeAuthorEdit inside updateProject is what keeps a moderator's lock; the
  // author's answer is merged into it rather than replacing it.
  const updated = await updateProject(project.id, { disclosures: body.disclosures })

  return { disclosures: updated.disclosures }
})
