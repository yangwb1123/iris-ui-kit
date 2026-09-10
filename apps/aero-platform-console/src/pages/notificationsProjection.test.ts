import { describe, expect, it } from 'vitest'
import { notificationProjection, notificationsDataset } from './notificationsProjection'

describe('Aero IM notification projection', () => {
  it('reads only the allow-listed notification snapshot envelope', () => {
    const projection = notificationProjection({
      snapshots: [
        { dataset: 'aero-im.workspaces', data: { items: [{ id: 'wrong' }] } },
        {
          dataset: notificationsDataset,
          status: 'fresh',
          data: {
            items: [{ notification_id: 'notification-1', kind: 'mention' }, 'invalid'],
            unread_count: 3,
            truncated: true,
            source_account_status: 'active',
          },
        },
      ],
    })

    expect(projection.items).toEqual([{ notification_id: 'notification-1', kind: 'mention' }])
    expect(projection.unreadCount).toBe(3)
    expect(projection.truncated).toBe(true)
    expect(projection.sourceAccountStatus).toBe('active')
    expect(projection.snapshot).toMatchObject({ status: 'fresh' })
  })

  it('fails closed to an empty view for malformed projection data', () => {
    const projection = notificationProjection({
      snapshots: [{ dataset: notificationsDataset, data: { items: 'bad', unread_count: -5 } }],
    })

    expect(projection.items).toEqual([])
    expect(projection.unreadCount).toBe(0)
    expect(projection.truncated).toBe(false)
    expect(projection.sourceAccountStatus).toBe('unknown')
  })
})
