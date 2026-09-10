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
