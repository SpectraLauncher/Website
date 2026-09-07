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

// A YouTube link alone on a line becomes a player. html:false means an <iframe>
// written by an author is escaped like any other tag, so this is the only way to
// have one — and it is safe because nothing from the source reaches an
// attribute: the id is matched against [A-Za-z0-9_-]{11} and the URL is built
// here, out of the id alone.
//
// To support another host: one pattern and one embed URL. Keep the id strict.
const YOUTUBE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})(?:[?&#]\S*)?$/

export function youtubeId(url: string): string | null {
  return YOUTUBE.exec(url.trim())?.[1] ?? null
}

md.core.ruler.push('youtube', (state) => {
  const tokens = state.tokens

  for (let i = 0; i + 2 < tokens.length; i++) {
    if (tokens[i]!.type !== 'paragraph_open') continue
    if (tokens[i + 1]!.type !== 'inline') continue
    if (tokens[i + 2]!.type !== 'paragraph_close') continue

    const id = youtubeId(tokens[i + 1]!.content)
    if (!id) continue

    const embed = new state.Token('html_block', '', 0)
    embed.content = '<div class="aspect-video overflow-hidden rounded-xl border border-white/10">'
      + `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube"`
      + ' loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"'
      + ' frameborder="0" class="size-full"></iframe></div>'

    tokens.splice(i, 3, embed)
  }
})

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
