
import { itemsOfSale, type SaleRow } from './checkout'
import { sendMail, mailTemplate } from './auth'

// The receipt is the only thing a guest gets. There is no account to come back
// to, so the link in it is their copy of the purchase - which is why it goes out
// on every sale, signed in or not, rather than only when there is nobody to tell
// otherwise.
export async function sendReceipt(sale: SaleRow): Promise<void> {
  if (!sale.buyer_email || !sale.access_token) return

  const items = await itemsOfSale(sale.id)
  const site = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const url = `${site}/order/${sale.access_token}`

  const titles = items.map(item => item.title).filter(Boolean)
  const body = titles.length === 1
    ? `Your copy of ${titles[0]} is ready to download.`
    : `Your ${titles.length} downloads are ready.`

  await sendMail(
    sale.buyer_email,
    titles.length === 1 ? `${titles[0]} — your download` : 'Your downloads',
    mailTemplate({
      preheader: body,
      eyebrow: 'Spectra',
      title: 'Thanks for your purchase',
      body: `${body} The link below stays valid, so keep this email if you are not signed in.`,
      ctaUrl: url,
      ctaLabel: 'Open your downloads',
      footnote: 'If you did not make this purchase, reply to this email and tell us.',
    }),
  )
}
