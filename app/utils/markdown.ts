import MarkdownIt from 'markdown-it'

// html: false is the whole sanitiser. Raw HTML in a project description is the
// obvious XSS route into every page that renders one, and no mod page has ever
// needed a <script> to explain what it does. Escaping HTML rather than cleaning
// it means there is no allowlist to get wrong later.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

// markdown-it decodes a punycode hostname back to Unicode for display, so a bare
// https://xn--pple-43d.com/ renders as apple.com with a Cyrillic a while linking
// to the real thing. The address is what a reader judges before clicking, so it
// is shown exactly as it will be visited.
md.normalizeLinkText = (url: string) => url

// Every link leaves for somewhere we do not control, so it opens away from the
// page and cannot reach back through window.opener.
const defaultLink = md.renderer.rules.link_open
  ?? ((tokens, i, options, _env, self) => self.renderToken(tokens, i, options))

md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  const token = tokens[i]!
  token.attrSet('rel', 'nofollow ugc noopener noreferrer')
  token.attrSet('target', '_blank')
  return defaultLink(tokens, i, options, env, self)
}

// Images come from anywhere a description points at, so they never get to run
// layout-shifting tricks or hotlink-track with referrers.
const defaultImage = md.renderer.rules.image
  ?? ((tokens, i, options, _env, self) => self.renderToken(tokens, i, options))

md.renderer.rules.image = (tokens, i, options, env, self) => {
  const token = tokens[i]!
  token.attrSet('loading', 'lazy')
  token.attrSet('referrerpolicy', 'no-referrer')
  return defaultImage(tokens, i, options, env, self)
}

export function renderMarkdown(source: string): string {
  return md.render(source || '')
}

export function markdownExcerpt(source: string, max = 200): string {
  const text = (source || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
