interface FaqEntry { q: string, a: string }
interface StepEntry { title: string, body: string }

export function useToolSeo(slug: string, key: string) {
  const { t, te, tm, rt } = useI18n()
  const localePath = useLocalePath()

  const tool = TOOLS.find(x => x.id === slug)

  const name = computed(() => {
    const localised = t(`${key}.title`)
    return localised === `${key}.title` ? (tool?.name ?? slug) : localised
  })

  const title = computed(() => `${name.value}`)
  const description = computed(() => {
    const sub = t(`${key}.sub`)
    return sub === `${key}.sub` ? t(`tools.${slug}`) : sub
  })

  useSeoMeta({
    title: () => title.value,
    description: () => description.value,
    ogTitle: () => title.value,
    ogDescription: () => description.value,
    twitterTitle: () => title.value,
    twitterDescription: () => description.value,
  })

  defineOgImage('Spectra', {
    title: () => name.value,
    description: () => description.value,
  })

  const list = <T>(path: string): T[] => {
    const value = tm(path)
    return Array.isArray(value) ? (value as T[]) : []
  }

  useSchemaOrg(computed(() => {
    const faq = list<FaqEntry>(`${key}.faq`)
      .map(entry => ({ q: rt(entry.q as unknown as string), a: rt(entry.a as unknown as string) }))
      .filter(entry => entry.q && entry.a)

    const steps = list<StepEntry>(`${key}.steps`)
      .map(entry => ({ title: rt(entry.title as unknown as string), body: rt(entry.body as unknown as string) }))
      .filter(entry => entry.title)

    return [
      defineWebPage(faq.length ? { '@type': ['WebPage', 'FAQPage'] } : {}),
      defineSoftwareApp({
        '@type': 'WebApplication',
        'name': name.value,
        'description': description.value,
        'applicationCategory': 'UtilitiesApplication',
        'operatingSystem': 'Any',
        'browserRequirements': 'Requires JavaScript',
        'isAccessibleForFree': true,
        'offers': { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }),
      defineBreadcrumb({
        itemListElement: [
          { name: 'Spectra', item: localePath('/') },
          { name: t('nav.tools'), item: localePath('/tools') },
          { name: name.value },
        ],
      }),
      ...faq.map(entry => defineQuestion({ name: entry.q, acceptedAnswer: entry.a })),
      ...(steps.length
        ? [defineHowTo({
            name: te(`${key}.howTitle`) ? t(`${key}.howTitle`) : name.value,
            step: steps.map(step => ({ name: step.title, text: step.body || step.title })),
          })]
        : []),
    ]
  }))
}
