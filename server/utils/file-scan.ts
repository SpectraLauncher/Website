
import { openZip, unsafeEntryName, ZIP_LIMITS, ZipError } from './zip'

// What a scan can conclude. Nothing here approves a file: the scanner raises a
// hand, a person decides. Treating a heuristic as a verdict is how a legitimate
// mod gets deleted and a clever one gets waved through.
export const SCAN_VERDICTS = ['clean', 'flagged', 'unreadable'] as const
export type ScanVerdict = typeof SCAN_VERDICTS[number]

export const FINDING_SEVERITIES = ['low', 'medium', 'high'] as const
export type FindingSeverity = typeof FINDING_SEVERITIES[number]

export interface Finding {
  code: string
  severity: FindingSeverity
  detail: string
}

export interface ScanResult {
  verdict: ScanVerdict
  findings: Finding[]
  scanned: number
}

// Native payloads have no business inside a mod jar. Extension alone is weak,
// since anyone can rename, so the magic bytes are checked too.
const EXECUTABLE_EXTENSIONS = [
  '.exe', '.dll', '.scr', '.bat', '.cmd', '.com', '.msi',
  '.so', '.dylib', '.sh', '.ps1', '.vbs', '.jse', '.wsf',
]

const MAGIC: Array<[string, number[]]> = [
  ['windows executable', [0x4D, 0x5A]],
  ['linux executable', [0x7F, 0x45, 0x4C, 0x46]],
  ['macos executable', [0xCF, 0xFA, 0xED, 0xFE]],
]

const ARCHIVE_EXTENSIONS = ['.zip', '.7z', '.rar', '.tar', '.gz']

// Hosts a mod has no reason to contact at runtime. Fractureiser pulled its
// later stages from exactly this kind of place.
//
// To add a host: one entry here. Keep it to hosts that serve arbitrary
// user-uploaded bytes, not to every domain that has ever hosted something bad.
const SUSPICIOUS_HOSTS = [
  'pastebin.com',
  'paste.ee',
  'hastebin.com',
  'anonfiles.com',
  'discord.com/api/webhooks',
  'discordapp.com/api/webhooks',
  'transfer.sh',
  'file.io',
  'temp.sh',
  '0x0.st',
]

// Markers left by the fractureiser family, which hit this ecosystem in 2023. A
// hit is not proof, but it is worth a person's time every single time.
const KNOWN_MARKERS = [
  'fractureiser',
  'dcQ3Bg1n',
]

const ENTRY_LIMIT = 400
const STRING_SCAN_BYTES = 2 * 1024 * 1024
const MAX_FINDINGS = 50

function endsWithAny(name: string, suffixes: string[]): string | null {
  const lower = name.toLowerCase()
  return suffixes.find(suffix => lower.endsWith(suffix)) ?? null
}

function magicOf(body: Buffer): string | null {
  for (const [label, bytes] of MAGIC) {
    if (bytes.every((byte, i) => body[i] === byte)) return label
  }
  return null
}

export function scanArchive(body: Uint8Array): ScanResult {
  const findings: Finding[] = []
  const add = (code: string, severity: FindingSeverity, detail: string) =>
    findings.push({ code, severity, detail })

  let zip
  try {
    zip = openZip(body)
  }
  catch (e) {
    // A file the reader refuses is not automatically hostile, it may simply be a
    // format we do not handle, but it cannot be published unexamined either.
    return {
      verdict: 'unreadable',
      findings: [{
        code: 'unreadable',
        severity: 'medium',
        detail: e instanceof ZipError ? e.message : 'archive could not be opened',
      }],
      scanned: 0,
    }
  }

  for (const entry of zip.entries) {
    if (unsafeEntryName(entry.name)) {
      add('path_traversal', 'high', entry.name)
      continue
    }

    if (endsWithAny(entry.name, EXECUTABLE_EXTENSIONS)) {
      add('executable_entry', 'high', entry.name)
    }

    if (endsWithAny(entry.name, ARCHIVE_EXTENSIONS)) {
      add('nested_archive', 'low', entry.name)
    }

    // An entry that expands far beyond its stored size is what makes an archive
    // a bomb. The reader refuses to decompress it later, so without this the
    // scan would report a clean file that nothing can actually process.
    const ratio = entry.compressedSize > 0
      ? entry.uncompressedSize / entry.compressedSize
      : 0

    if (entry.uncompressedSize > ZIP_LIMITS.maxEntryUncompressed || ratio > ZIP_LIMITS.maxRatio) {
      add('compression_bomb', 'high',
        `${entry.name} expands to ${entry.uncompressedSize} bytes`)
    }
  }

  // Reading every entry would mean decompressing the whole archive, so the
  // byte-level checks go only to entries small enough to be cheap.
  const candidates = zip.entries
    .filter(entry => entry.uncompressedSize > 3 && entry.uncompressedSize < 8 * 1024 * 1024)
    .slice(0, ENTRY_LIMIT)

  let scanned = 0
  for (const entry of candidates) {
    let content: Buffer | null = null
    try {
      content = zip.read(entry.name)
    }
    catch {
      add('entry_unreadable', 'low', entry.name)
      continue
    }
    if (!content) continue

    scanned++

    // A class file starts with CAFEBABE, so it never matches these.
    const disguised = magicOf(content)
    if (disguised) {
      add('disguised_executable', 'high', `${entry.name} looks like a ${disguised}`)
    }

    const text = content.subarray(0, STRING_SCAN_BYTES).toString('latin1')

    for (const host of SUSPICIOUS_HOSTS) {
      if (text.includes(host)) add('suspicious_host', 'medium', `${entry.name} contacts ${host}`)
    }

    for (const marker of KNOWN_MARKERS) {
      if (text.includes(marker)) add('known_marker', 'high', `${entry.name} carries ${marker}`)
    }
  }

  // One finding of each kind is enough for a person to go and look; a hundred
  // copies of the same line only buries the other findings.
  const seen = new Set<string>()
  const unique = findings.filter((finding) => {
    const key = `${finding.code}:${finding.detail}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, MAX_FINDINGS)

  // Only medium and high decide the verdict. A low finding is worth recording
  // and worth a glance, but a real plugin ships a language pack as a nested zip,
  // and a scanner that flags WorldEdit is one nobody reads after a week.
  const decisive = unique.some(f => f.severity !== 'low')

  return {
    verdict: decisive ? 'flagged' : 'clean',
    findings: unique,
    scanned,
  }
}

export function worstSeverity(findings: Finding[]): FindingSeverity | null {
  if (findings.some(f => f.severity === 'high')) return 'high'
  if (findings.some(f => f.severity === 'medium')) return 'medium'
  return findings.length ? 'low' : null
}
