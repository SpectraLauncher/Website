export default defineEventHandler(async (event) => {
  await requireModeration(event)

  const held = await heldVersions()
  const released = new Map<string, Array<Record<string, unknown>>>()
  for (const projectId of new Set(held.map(v => v.project_id))) {
    released.set(projectId, (await versionsOf(projectId)).map(v => v.meta))
  }

  return {
    versions: held.map(v => ({
      id: v.id,
      number: v.number,
      created: num(v.created),
      meta: v.meta,
      asks: newAddonAsks(released.get(v.project_id) ?? [], v.meta),
      project: { id: v.project_id, slug: v.slug, title: v.title, path: projectPath(v.type as ProjectType, v.slug) },
    })),
  }
})
