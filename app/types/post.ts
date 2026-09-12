/** An article or a newsletter issue, as the admin editor works on it. */
export interface AdminPost {
  id: string
  kind: 'article' | 'newsletter'
  slug: string | null
  title: string
  summary: string
  body: Record<string, any>
  cover: string | null
  status: string
  published: number | null
  sent: number | null
  recipients: number
}
