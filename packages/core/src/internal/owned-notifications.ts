/**
 * PRIVATE, source-only D1–D3 pilot. Not imported by any package entry or adapter.
 * Legacy notifications remain untouched/default. No performance acceptance implied.
 */
import type { DesktopNotification } from '../notifications'
import type { ReadonlyStore } from '../store'
import { generateId } from '../utils'
import {
  admitImport,
  admitPost,
  OWNED_NOTIFICATION_LIMITS,
  refuse,
} from './owned-notification-input'
import {
  emptyOwnedData,
  exportOwned,
  materializeOwned,
  nextOwnedRevision,
  prependOwned,
  removeOwned,
  replaceOwned,
  type OwnedNotificationData,
  type OwnedNotificationView,
} from './owned-notification-state'

type Listener = (view: OwnedNotificationView) => void
interface Revision {
  readonly data: OwnedNotificationData
  readonly number: number
  view: OwnedNotificationView | undefined
}
export interface OwnedNotificationPilot extends ReadonlyStore<OwnedNotificationView> {
  readonly store: ReadonlyStore<OwnedNotificationView>
  post(input: unknown): string
  dismiss(id: string): void
  dismissAll(): void
  importRecords(input: unknown): void
  exportRecords(): DesktopNotification[]
}

// Revision ownership, read caching and publication form one private responsibility.
// The command facade below owns admission; neither this owner nor its roots escape it.
class NotificationRevisionOwner {
  #current: Revision = { data: emptyOwnedData(), number: 0, view: undefined }
  #listeners = new Set<Listener>()

  capture(): Revision {
    return this.#current
  }

  assertCurrent(expected: Revision): void {
    if (this.#current !== expected) refuse('SUPERSEDED')
  }

  getState(): OwnedNotificationView {
    const expected = this.#current
    if (expected.view) return expected.view
    const view = materializeOwned(expected.data, expected.number)
    this.assertCurrent(expected)
    expected.view = view
    return view
  }

  commit(expected: Revision, data: OwnedNotificationData): void {
    const number = nextOwnedRevision(expected.number)
    // All demanded materialization and possible failure/reentry precedes publication.
    const view = this.#listeners.size ? materializeOwned(data, number) : undefined
    const next: Revision = { data, number, view }
    this.assertCurrent(expected)
    this.#current = next
    // Same Set membership/order/fail-fast policy as createStore, but no writable-store
    // cast: an atomic private root and lazy views require a different commit boundary.
    if (view)
      for (const listener of [...this.#listeners]) if (this.#listeners.has(listener)) listener(view)
  }

  subscribe(listener: Listener): () => void {
    if (typeof listener !== 'function') refuse('LISTENER')
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  exportRecords(): DesktopNotification[] {
    const expected = this.#current
    const records = exportOwned(expected.data)
    this.assertCurrent(expected)
    return records
  }
}

export function createOwnedNotificationPilot(): OwnedNotificationPilot {
  // One owner per factory closure/lifecycle epoch; import transfers data, never authority.
  const owner = new NotificationRevisionOwner()
  const getState = () => owner.getState()
  const subscribe = (listener: Listener) => owner.subscribe(listener)

  function post(input: unknown): string {
    const expected = owner.capture()
    const item = admitPost(input, () => generateId('ntf'))
    owner.commit(expected, prependOwned(expected.data, item))
    return item.record.id
  }

  function dismiss(id: string): void {
    if (typeof id !== 'string' || id.length > OWNED_NOTIFICATION_LIMITS.stringText) refuse('ID')
    const expected = owner.capture()
    const data = removeOwned(expected.data, id)
    owner.assertCurrent(expected)
    if (data) owner.commit(expected, data)
  }

  function dismissAll(): void {
    const expected = owner.capture()
    if (expected.data.count) owner.commit(expected, emptyOwnedData())
  }

  function importRecords(input: unknown): void {
    const expected = owner.capture()
    owner.commit(expected, replaceOwned(admitImport(input)))
  }

  const store = Object.freeze({ getState, subscribe })
  return Object.freeze({
    store,
    getState,
    subscribe,
    post,
    dismiss,
    dismissAll,
    importRecords,
    exportRecords: () => owner.exportRecords(),
  })
}
