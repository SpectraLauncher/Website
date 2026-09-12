/**
 * What the catalog endpoints send, as the browser sees it.
 *
 * These lived inside catalog/Project.vue, which meant a composable had to import
 * a type out of a component to describe its own return value. The data layer
 * does not depend on the view; it depends on this.
 *
 * ProjectType, CatalogDependency and DisclosureMap are auto-imported.
 */

export interface CatalogVersionFile {
  id: string
  filename: string
  size: number
  hashes: { sha1: string, sha512: string }
  primary: boolean
}

export interface CatalogVersion {
  id: string
  number: string
  name: string
  channel: string
  gameVersions: string[]
  loaders: string[]
  downloads: number
  created: number
  changelog?: string
  meta: Record<string, any>
  files: CatalogVersionFile[]
  dependencies?: CatalogDependency[]
}

/** A project that depends on the one being viewed. */
export interface DependentProject {
  id: string
  slug: string
  type: ProjectType
  title: string
  icon: string | null
  downloads: number
}

export interface CatalogProjectData {
  id: string
  slug: string
  type: string
  path: string
  title: string
  summary: string
  description: string
  icon: string | null
  license: string | null
  licenseUrl: string | null
  links: Record<string, string>
  disclosures: DisclosureMap
  categories: string[]
  loaders: string[]
  gameVersions: string[]
  environment?: string[]
  downloads: number
  created: number
  updated: number
  versions: CatalogVersion[]
  price?: number
  canDownload?: boolean
  currency?: string
  owned?: boolean
  follows: number
  following?: boolean
  dependents?: DependentProject[]
  favourited?: boolean
  owner?: {
    kind: 'user' | 'organization'
    slug: string | null
    name: string | null
    image: string | null
  } | null
}

/** One picture in a project's gallery. */
export interface GalleryImage {
  id: string
  url: string
  title: string
  featured: boolean
}
