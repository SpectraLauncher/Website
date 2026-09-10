export interface SideNavItem {
  id: string
  icon: string
  label: string
  badge?: string | number
  // Items carrying the same group land under one heading. Leave it out and the
  // item joins the untitled block wherever it sits in the list.
  group?: string
}

export interface SideNavSection {
  title: string
  items: SideNavItem[]
}

/**
 * Source order wins over grouping: the sidebar reads like the list the page
 * declared, and an item added next to its neighbours slots in without moving
 * anything else. The same group named twice with something else in between
 * therefore renders as two blocks — which is what the page asked for.
 */
export function groupSideNav(items: SideNavItem[]): SideNavSection[] {
  const sections: SideNavSection[] = []

  for (const item of items) {
    const title = item.group ?? ''
    const last = sections.at(-1)

    if (last && last.title === title) last.items.push(item)
    else sections.push({ title, items: [item] })
  }

  return sections
}
