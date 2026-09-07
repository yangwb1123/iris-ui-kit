import type { AggregateView, JsonRecord } from '../types'

export const notificationsDataset = 'aero-im.notifications'

export interface NotificationProjection {
  items: JsonRecord[]
  unreadCount: number
  truncated: boolean
  sourceAccountStatus: string
  snapshot?: JsonRecord
  view: AggregateView
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function notificationProjection(view: AggregateView): NotificationProjection {
  const snapshot = view.snapshots?.find((item) => item.dataset === notificationsDataset)
  const data = isRecord(snapshot?.data) ? snapshot.data : {}
  const items = Array.isArray(data.items) ? data.items.filter(isRecord) : []
  const unreadCount =
    typeof data.unread_count === 'number' && Number.isFinite(data.unread_count)
      ? Math.max(0, data.unread_count)
      : 0
  return {
    items,
    unreadCount,
    truncated: data.truncated === true,
    sourceAccountStatus:
      typeof data.source_account_status === 'string' ? data.source_account_status : 'unknown',
    snapshot,
    view,
  }
}
