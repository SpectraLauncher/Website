
export const MIN_LENGTH = 3
export const MAX_LENGTH = 30

const TRANSLITERATE: Record<string, string> = {
  ł: 'l', Ł: 'l', ø: 'o', Ø: 'o', đ: 'd', Đ: 'd', ß: 'ss', æ: 'ae', Æ: 'ae',
}

export function usernameBase(raw: string): string {
  const slug = [...raw.trim()]
    .map(ch => TRANSLITERATE[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, '_')
    .replace(/[._]{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, MAX_LENGTH)

  return slug.length >= MIN_LENGTH ? slug : `player${slug}`.slice(0, MAX_LENGTH)
}

export function withSuffix(base: string, suffix: string) {
  return base.slice(0, MAX_LENGTH - suffix.length) + suffix
}
