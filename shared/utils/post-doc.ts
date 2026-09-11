import { safeAssetUrl, safeUrl } from './links'

/**
 * A Tiptap document, rendered to HTML by an allowlist.
 *
 * The editor runs in a browser, so whatever it sends is whatever somebody chose
 * to send — an author's HTML is no more trustworthy than a stranger's markdown,
 * which is why markdown-it runs here with html:false. The same rule applies: the
 * document is stored as the editor's own JSON and the server decides what tags
 * exist, so there is nothing to sanitise after the fact and no HTML from a
 * client is ever echoed back.
 *
 * To allow a node or a mark: an entry in NODES or MARKS. Anything absent renders
 * as its text content, so an unknown node loses its formatting and never its
 * words.
 */
export interface PostNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type?: string, attrs?: Record<string, unknown> }>
  content?: PostNode[]
}

const MAX_NODES = 5_000
const MAX_DEPTH = 20

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))
}

const HEADINGS = new Set([2, 3, 4])

// Block and inline nodes, by the names Tiptap's StarterKit gives them.
const NODES: Record<string, (node: PostNode, inner: string) => string> = {
  doc: (_n, inner) => inner,
  paragraph: (_n, inner) => (inner ? `<p>${inner}</p>` : ''),
  text: node => escapeHtml(node.text ?? ''),
  hardBreak: () => '<br>',
  horizontalRule: () => '<hr>',
  bulletList: (_n, inner) => `<ul>${inner}</ul>`,
  orderedList: (_n, inner) => `<ol>${inner}</ol>`,
  listItem: (_n, inner) => `<li>${inner}</li>`,
  blockquote: (_n, inner) => `<blockquote>${inner}</blockquote>`,
  codeBlock: (_n, inner) => `<pre><code>${inner}</code></pre>`,

  // h1 belongs to the page, which prints the title. An author choosing it would
  // put two first-level headings on one document.
  heading: (node, inner) => {
    const level = Number(node.attrs?.level)
    const tag = HEADINGS.has(level) ? `h${level}` : 'h2'
    return `<${tag}>${inner}</${tag}>`
  },

  image: (node) => {
    const src = safeAssetUrl(node.attrs?.src)
    if (!src) return ''

    const alt = escapeHtml(String(node.attrs?.alt ?? ''))
    return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy">`
  },
}

const MARKS: Record<string, (inner: string, attrs?: Record<string, unknown>) => string> = {
  bold: inner => `<strong>${inner}</strong>`,
  italic: inner => `<em>${inner}</em>`,
  strike: inner => `<s>${inner}</s>`,
  code: inner => `<code>${inner}</code>`,

  // Someone else's link on our page: nofollow so it carries no ranking, and
  // noopener so the opened tab cannot reach back through window.opener.
  link: (inner, attrs) => {
    const href = safeUrl(attrs?.href)
    return href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="nofollow noopener noreferrer">${inner}</a>`
      : inner
  },
}

export function renderPostDoc(doc: unknown): string {
  let budget = MAX_NODES

  function render(node: PostNode, depth: number): string {
    if (budget-- <= 0 || depth > MAX_DEPTH) return ''

    const inner = (node.content ?? [])
      .map(child => render(child, depth + 1))
      .join('')

    const build = NODES[String(node.type ?? '')]
    // An unknown node keeps its words and loses its shape, rather than being
    // dropped whole: losing a paragraph is worse than losing its styling.
    let out = build ? build(node, inner) : inner

    for (const mark of node.marks ?? []) {
      const apply = MARKS[String(mark.type ?? '')]
      if (apply) out = apply(out, mark.attrs)
    }

    return out
  }

  if (!doc || typeof doc !== 'object') return ''
  return render(doc as PostNode, 0)
}

/** The first words of a document, for a listing card or a search result. */
export function postExcerpt(doc: unknown, max = 200): string {
  const parts: string[] = []
  let budget = MAX_NODES

  function walk(node: PostNode) {
    if (budget-- <= 0 || parts.join(' ').length > max * 2) return
    if (node.text) parts.push(node.text)
    for (const child of node.content ?? []) walk(child)
  }

  if (doc && typeof doc === 'object') walk(doc as PostNode)

  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Every image the document points at, so the store knows what it still needs. */
export function postImageUrls(doc: unknown): string[] {
  const out = new Set<string>()
  let budget = MAX_NODES

  function walk(node: PostNode) {
    if (budget-- <= 0) return
    if (node.type === 'image') {
      const src = safeAssetUrl(node.attrs?.src)
      if (src) out.add(src)
    }
    for (const child of node.content ?? []) walk(child)
  }

  if (doc && typeof doc === 'object') walk(doc as PostNode)
  return [...out]
}
