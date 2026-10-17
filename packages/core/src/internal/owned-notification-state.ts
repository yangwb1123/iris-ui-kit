/** PRIVATE owned roots. Nodes never reference a public array or a revision-view cache. */
import type { DesktopNotification } from '../notifications'
import {
  appendOwn,
  OWNED_NOTIFICATION_LIMITS,
  refuse,
  type AdmittedNotification,
} from './owned-notification-input'

interface Link {
  readonly item: AdmittedNotification
  readonly next: Link | null
}
export interface OwnedNotificationData {
  readonly head: Link | null
  readonly count: number
  readonly text: number
}
export interface OwnedNotificationView {
  readonly revision: number
  readonly notifications: readonly Readonly<DesktopNotification>[]
}

export function nextOwnedRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER)
    refuse('REVISION_EXHAUSTED')
  return revision + 1
}

function checked(data: OwnedNotificationData): OwnedNotificationData {
  // Array and length metadata + eight nodes/record, including optional undefined leaves.
  if (
    data.count > OWNED_NOTIFICATION_LIMITS.elements ||
    2 + data.count * 8 > OWNED_NOTIFICATION_LIMITS.nodes ||
    data.text > OWNED_NOTIFICATION_LIMITS.totalText
  )
    refuse('LIVE_LIMIT')
  return data
}

export function emptyOwnedData(): OwnedNotificationData {
  return { head: null, count: 0, text: 'length'.length }
}

export function prependOwned(
  data: OwnedNotificationData,
  item: AdmittedNotification,
): OwnedNotificationData {
  for (let link = data.head; link; link = link.next) {
    if (link.item.record.id === item.record.id) refuse('DUPLICATE_ID')
  }
  return checked({
    head: { item, next: data.head },
    count: data.count + 1,
    text: data.text + item.text + String(data.count).length,
  })
}

export function replaceOwned(items: AdmittedNotification[]): OwnedNotificationData {
  let head: Link | null = null,
    text = 'length'.length
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]!
    head = { item, next: head }
    text += item.text + String(index).length
  }
  return checked({ head, count: items.length, text })
}

export function removeOwned(
  data: OwnedNotificationData,
  id: string,
): OwnedNotificationData | undefined {
  const prefix: AdmittedNotification[] = []
  let link = data.head
  while (link && link.item.record.id !== id) {
    appendOwn(prefix, link.item)
    link = link.next
  }
  if (!link) return undefined
  let head = link.next
  for (let index = prefix.length - 1; index >= 0; index--)
    head = { item: prefix[index]!, next: head }
  return {
    head,
    count: data.count - 1,
    text: data.text - link.item.text - String(data.count - 1).length,
  }
}

export function materializeOwned(
  data: OwnedNotificationData,
  revision: number,
): OwnedNotificationView {
  const notifications: Readonly<DesktopNotification>[] = []
  for (let link = data.head; link; link = link.next) appendOwn(notifications, link.item.record)
  return Object.freeze({ revision, notifications: Object.freeze(notifications) })
}

export function exportOwned(data: OwnedNotificationData): DesktopNotification[] {
  const records: DesktopNotification[] = []
  for (let link = data.head; link; link = link.next) appendOwn(records, { ...link.item.record })
  return records
}
