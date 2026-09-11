/** One row of /api/catalog/search — the subset of shortProject a listing draws. */
export interface CatalogHit {
  id: string
  slug: string
  path: string
  type: string
  title: string
  summary: string
  icon: string | null
  categories: string[]
  gameVersions: string[]
  loaders: string[]
  downloads: number
  follows: number
  price: number
  updated: number
}

/** One entry in a version's dependency list, as the project endpoint sends it. */
export interface CatalogDependency {
  id: string
  kind: string
  /** True when the dependency is a project here and can be linked to. */
  hosted: boolean
  slug: string | null
  type: ProjectType | null
  title: string | null
  versionNumber: string | null
  external: Record<string, any> | null
}
