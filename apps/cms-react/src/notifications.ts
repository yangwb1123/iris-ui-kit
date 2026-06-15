import * as React from 'react'

/**
 * A tiny module-level notification log for the header bell — a persistent
 * counterpart to the transient toasts. The CRUD page pushes here on every
 * mutate so there's a durable activity feed (toasts fade; these stay until
 * cleared). No deps: a plain subscribable store + a `useSyncExternalStore` hook.
 */
export type NotificationTone = 'success' | 'error' | 'info'

export interface Notification {
  id: string
  title: string
  description?: string
  tone: NotificationTone
  at: number
  read: boolean
}

let items: Notification[] = []
const listeners = new Set<() => void>()
let seq = 0

function emit(): void {
  for (const l of listeners) l()
}

/** Push a notification onto the log (newest first, capped at 30). */
export function notify(input: {
  title: string
  description?: string
  tone?: NotificationTone
}): void {
  const next: Notification = {
    id: `n-${seq++}`,
    title: input.title,
    description: input.description,
    tone: input.tone ?? 'info',
    at: Date.now(),
    read: false,
  }
  items = [next, ...items].slice(0, 30)
  emit()
}

/** Mark every notification as read. */
export function markAllRead(): void {
  if (items.every((n) => n.read)) return
  items = items.map((n) => (n.read ? n : { ...n, read: true }))
  emit()
}

/** Drop all notifications. */
export function clearNotifications(): void {
  if (items.length === 0) return
  items = []
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): Notification[] => items

/** React binding: the live notification list. */
export function useNotifications(): Notification[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
