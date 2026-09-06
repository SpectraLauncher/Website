// Every legal document, in the order the hub lists them. The id is the key into
// the locale files; the path is where it answers. The three that predate the hub
// keep their top-level address, because they are linked from outside this site.
//
// To add a document: an entry here, a page rendering <LegalPage :section="id" />,
// and a `<id>` block per locale with title, intro, updated and sections.
export const LEGAL_DOCUMENTS = [
  { id: 'terms', path: '/terms', icon: 'i-lucide-handshake' },
  { id: 'rules', path: '/legal/rules', icon: 'i-lucide-scale' },
  { id: 'copyright', path: '/legal/copyright', icon: 'i-lucide-copyright' },
  { id: 'monetization', path: '/legal/monetization', icon: 'i-lucide-wallet' },
  { id: 'privacy', path: '/privacy', icon: 'i-lucide-lock' },
  { id: 'cookies', path: '/cookies', icon: 'i-lucide-cookie' },
  { id: 'security', path: '/legal/security', icon: 'i-lucide-shield' },
] as const

export type LegalDocument = typeof LEGAL_DOCUMENTS[number]['id']

export const LEGAL_IDS = LEGAL_DOCUMENTS.map(doc => doc.id) as readonly LegalDocument[]

export function legalPath(id: LegalDocument): string {
  return LEGAL_DOCUMENTS.find(doc => doc.id === id)!.path
}
