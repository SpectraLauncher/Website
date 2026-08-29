const SPACE = 32
const SLASH = 47
const BACKSLASH = 92
const DELETE = 127

export function safeNext(value: unknown, fallback: string): string {
  const path = typeof value === 'string' ? value.trim() : ''

  if (path.charCodeAt(0) !== SLASH) return fallback

  const second = path.charCodeAt(1)
  if (second === SLASH || second === BACKSLASH) return fallback

  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i)
    if (code < SPACE || code === DELETE) return fallback
  }

  return path
}
