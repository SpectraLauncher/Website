export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365)
  const orgs = await organizationsOf(user.id)

  // Narrowed to one organization for its own analytics tab. Filtering the list
  // the caller already belongs to is what keeps this from becoming a way to
  // read somebody else's numbers.
  const wanted = typeof query.org === 'string' ? query.org : ''
  const scope = wanted ? orgs.filter(org => org.slug === wanted) : orgs

  if (wanted && !scope.length) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  const mine = wanted
    ? await orgProjects(scope[0]!.id, true)
    : await ownedProjects(user.id, orgs.map(org => org.id))

  const projects = await Promise.all(mine.map(async (project) => {
    const totals = await totalsForProject(project.id)
    return {
      id: project.id,
      title: project.title,
      path: projectPath(project.type, project.slug),
      views: totals?.views ?? 0,
      downloads: totals?.downloads ?? 0,
      series: await metricsForProject(project.id, days),
    }
  }))

  return {
    days,
    projects: projects.sort((a, b) => b.views - a.views),
    totals: {
      views: projects.reduce((sum, p) => sum + p.views, 0),
      downloads: projects.reduce((sum, p) => sum + p.downloads, 0),
    },
  }
})
