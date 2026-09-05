export default defineSitemapEventHandler(async () => {
  const badges = await q<{ slug: string }>('SELECT slug FROM badge ORDER BY created DESC')
    .catch(() => [] as Array<{ slug: string }>)

  const entries = badges.map(badge => ({
    loc: `/badges/${badge.slug}`,
    changefreq: 'monthly' as const,
    priority: 0.5,
    _i18nTransform: true,
  }))

  if (!catalogIsIndexable()) return entries

  const projects = await q<{ slug: string, type: ProjectType, updated: string }>(
    `SELECT slug, type, updated FROM project WHERE status = ANY($1) ORDER BY updated DESC`,
    [LISTED_STATUSES])
    .catch(() => [] as Array<{ slug: string, type: ProjectType, updated: string }>)

  const organizations = await q<{ slug: string }>(
    `SELECT DISTINCT o.slug FROM organization o
     JOIN project p ON p.org_id = o.id AND p.status = ANY($1)`, [LISTED_STATUSES])
    .catch(() => [] as Array<{ slug: string }>)

  return entries.concat(projects.map(project => ({
    loc: projectPath(project.type, project.slug),
    changefreq: 'weekly' as const,
    priority: 0.7,
    lastmod: new Date(Number(project.updated)).toISOString(),
    _i18nTransform: true,
  })) as typeof entries).concat(organizations.map(org => ({
    loc: `/org/${org.slug}`,
    changefreq: 'monthly' as const,
    priority: 0.5,
    _i18nTransform: true,
  })) as typeof entries)
})
