export default defineSitemapEventHandler(async () => {
  const badges = await q<{ slug: string }>('SELECT slug FROM badge ORDER BY created DESC')
    .catch(() => [] as Array<{ slug: string }>)

  return badges.map(badge => ({
    loc: `/badges/${badge.slug}`,
    changefreq: 'monthly' as const,
    priority: 0.5,
    _i18nTransform: true,
  }))
})
