import type { CatalogVersion } from '~/types/catalog'
import type { DropdownMenuItem } from '@nuxt/ui'

/** Where a single version lives, given the project's own address. */
export function useVersionLink(path: () => string) {
  return (version: { id: string }) => `${path()}/version/${version.id}`
}

interface MenuContext {
  path: string
  canEdit: boolean
}

/**
 * The row menu, shared by the versions list and the version page so the two
 * cannot offer different things for the same version.
 *
 * Editing is one entry rather than Modrinth's three: the number, the name, the
 * channel, the loaders, the game versions and the changelog are one form here,
 * and three items opening it at three anchors would be a menu pretending to be
 * more than it is. Files are not in it because a file is a new version.
 */
export function useVersionMenu(context: () => MenuContext) {
  const { t } = useI18n()
  const toast = useToast()
  const localePath = useLocalePath()
  const origin = useRequestURL().origin
  const link = useVersionLink(() => context().path)

  async function copy(value: string, title: string) {
    await navigator.clipboard.writeText(value)
    toast.add({ title, icon: 'i-pixelarticons-check' })
  }

  return (version: CatalogVersion): DropdownMenuItem[][] => {
    const { canEdit } = context()
    const primary = version.files.find(file => file.primary) ?? version.files[0]
    const to = localePath(link(version))

    const open: DropdownMenuItem[] = [
      {
        label: t('catalog.version.openNewTab'),
        icon: 'i-pixelarticons-external-link',
        to,
        target: '_blank',
      },
      {
        label: t('catalog.version.copyLink'),
        icon: 'i-pixelarticons-link',
        onSelect: () => copy(`${origin}${to}`, t('catalog.version.linkCopied')),
      },
      {
        label: t('catalog.version.copyId'),
        icon: 'i-pixelarticons-hash',
        onSelect: () => copy(version.id, t('catalog.version.idCopied')),
      },
    ]

    if (primary) {
      open.unshift({
        label: t('catalog.download'),
        icon: 'i-pixelarticons-download',
        to: `/api/catalog/download/${primary.id}`,
        external: true,
      })
    }

    if (!canEdit) return [open]

    return [open, [
      {
        label: t('catalog.version.edit'),
        icon: 'i-pixelarticons-edit',
        to: localePath(`${context().path}/settings/version/${version.id}`),
      },
      {
        label: t('catalog.version.remove'),
        icon: 'i-pixelarticons-trash',
        color: 'error' as const,
        to: localePath(`${context().path}/settings/version/${version.id}`),
      },
    ]]
  }
}
