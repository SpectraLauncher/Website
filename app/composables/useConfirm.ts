export interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void
}

// window.confirm blocks the page, cannot be styled, and on some browsers offers
// to suppress every later one — which would silently turn "delete this
// organization?" into a yes. This is the same shape, awaited the same way, with
// a dialog we own.
//
//   if (!await confirm({ title: t('...'), danger: true })) return
export function useConfirm() {
  const pending = useState<PendingConfirm | null>('confirm-dialog', () => null)

  function ask(request: ConfirmRequest): Promise<boolean> {
    // A second question while one is open would drop the first one's promise,
    // leaving whatever awaited it hanging forever.
    if (pending.value) return Promise.resolve(false)

    return new Promise<boolean>((resolve) => {
      pending.value = { ...request, resolve }
    })
  }

  function answer(ok: boolean) {
    const open = pending.value
    pending.value = null
    open?.resolve(ok)
  }

  return { pending, ask, answer }
}
