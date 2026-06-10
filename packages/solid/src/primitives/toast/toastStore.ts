import { createStore, generateId } from '@iris-ui/core'

export type IrisToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

export interface IrisToastInput {
  /** Stable id; if reused, the existing toast is updated in place. */
  id?: string
  title?: string
  description?: string
  variant?: IrisToastVariant
  /** Auto-dismiss duration in ms. `0` or `Infinity` disables auto-dismiss. */
  duration?: number
  /** Optional action label + handler. */
  action?: { label: string; onClick: () => void }
}

export interface IrisToast extends Required<Omit<IrisToastInput, 'action'>> {
  action: IrisToastInput['action']
  createdAt: number
}

const DEFAULT_DURATION = 4000

/**
 * Module-level singleton toast store. The store is intentionally global so
 * that `useToast()` from any component reaches the same queue — calls do
 * not require a context provider.
 */
const store = createStore<IrisToast[]>([])

/** Subscribe to changes. */
export const subscribeToasts = (listener: (toasts: IrisToast[]) => void) =>
  store.subscribe(listener)

/** Read current toasts. */
export const getToasts = (): IrisToast[] => store.getState()

/**
 * Push a toast onto the queue. If an `id` is supplied and matches an existing
 * toast, the entry is replaced in place (and its timer reset).
 *
 * Returns the toast id so the caller can `dismissToast(id)` later.
 */
export function pushToast(input: IrisToastInput): string {
  const id = input.id ?? generateId('iris-toast')
  const next: IrisToast = {
    id,
    title: input.title ?? '',
    description: input.description ?? '',
    variant: input.variant ?? 'default',
    duration: input.duration ?? DEFAULT_DURATION,
    action: input.action,
    createdAt: Date.now(),
  }
  store.setState((prev) => {
    const idx = prev.findIndex((t) => t.id === id)
    if (idx >= 0) {
      const copy = [...prev]
      copy[idx] = next
      return copy
    }
    return [...prev, next]
  })
  return id
}

/** Remove a toast by id. */
export function dismissToast(id: string): void {
  store.setState((prev) => prev.filter((t) => t.id !== id))
}

/** Remove all toasts. */
export function clearToasts(): void {
  store.setState([])
}
