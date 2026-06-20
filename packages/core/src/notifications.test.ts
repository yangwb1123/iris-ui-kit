import { describe, it, expect, vi } from 'vitest'
import {
  createNotificationCenter,
  DEFAULT_NOTIFICATION_TIMEOUT,
  type NotificationCenterState,
} from './notifications'

describe('createNotificationCenter', () => {
  it('posts newest-first with tone/timeout defaults and returns an id', () => {
    const nc = createNotificationCenter()
    const id1 = nc.post({ title: 'First' })
    const id2 = nc.post({ title: 'Second', tone: 'success', timeout: 0, appId: 'appstore' })
    expect(id1).not.toBe(id2)
    const list = nc.list()
    expect(list.map((n) => n.title)).toEqual(['Second', 'First']) // newest first
    expect(list[1]).toMatchObject({ tone: 'info', timeout: DEFAULT_NOTIFICATION_TIMEOUT })
    expect(list[0]).toMatchObject({ tone: 'success', timeout: 0, appId: 'appstore' })
  })

  it('dismiss removes one; dismissAll clears; missing id is a no-op', () => {
    const nc = createNotificationCenter()
    const a = nc.post({ title: 'A' })
    nc.post({ title: 'B' })
    nc.dismiss('nope') // no-op
    expect(nc.list()).toHaveLength(2)
    nc.dismiss(a)
    expect(nc.list().map((n) => n.title)).toEqual(['B'])
    nc.dismissAll()
    expect(nc.list()).toHaveLength(0)
  })

  it('notifies subscribers on post + dismiss', () => {
    const nc = createNotificationCenter()
    const seen: number[] = []
    const off = nc.subscribe((s: NotificationCenterState) => seen.push(s.notifications.length))
    const id = nc.post({ title: 'X' })
    nc.dismiss(id)
    off()
    nc.post({ title: 'after-unsub' })
    expect(seen).toEqual([1, 0]) // post → 1, dismiss → 0; nothing after unsubscribe
  })

  it('passes through body + icon', () => {
    const nc = createNotificationCenter()
    const handler = vi.fn()
    nc.subscribe(handler)
    nc.post({ title: 'Installed Calculator', body: 'Added to your desktop', icon: '🧮' })
    expect(nc.list()[0]).toMatchObject({ body: 'Added to your desktop', icon: '🧮' })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
