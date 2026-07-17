import { clearToasts, dismissToast, pushToast, type IrisToastInput } from './toastStore'

export interface UseToastReturn {
  /** Push a new toast (or replace by id). Returns the toast id. */
  push: (input: IrisToastInput) => string
  /** Convenience: push with variant pre-set. */
  success: (input: Omit<IrisToastInput, 'variant'>) => string
  error: (input: Omit<IrisToastInput, 'variant'>) => string
  warning: (input: Omit<IrisToastInput, 'variant'>) => string
  info: (input: Omit<IrisToastInput, 'variant'>) => string
  /** Remove a toast by id. */
  dismiss: (id: string) => void
  /** Remove all toasts. */
  clear: () => void
}

/**
 * Hook for the global toast queue. Backed by a module-level singleton
 * store, so it works **without** a surrounding provider — but the page
 * must mount exactly one `<IrisToastViewport>` somewhere for toasts to
 * actually be visible.
 *
 * @example
 *   const toast = useToast()
 *   toast.success({ title: 'Saved', description: 'Your changes are live.' })
 *   toast.error({ title: 'Failed', duration: 6000 })
 */
export function useToast(): UseToastReturn {
  return {
    push: pushToast,
    success: (input) => pushToast({ ...input, variant: 'success' }),
    error: (input) => pushToast({ ...input, variant: 'danger' }),
    warning: (input) => pushToast({ ...input, variant: 'warning' }),
    info: (input) => pushToast({ ...input, variant: 'info' }),
    dismiss: dismissToast,
    clear: clearToasts,
  }
}
