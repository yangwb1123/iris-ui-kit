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

  it('post records appId if provided', () => {
    const nc = createNotificationCenter()
    nc.post({ title: 'A', appId: 'store' })
    nc.post({ title: 'B' })
    expect(nc.list().map((n) => n.title)).toEqual(['B', 'A'])
  })

  it('subscriber receives notifications on post', () => {
    const nc = createNotificationCenter()
    const seen: number[] = []
    nc.subscribe((s) => seen.push(s.notifications.length))
    nc.post({ title: 'X' })
    expect(seen).toEqual([1])
  })

  it('list returns all notifications', () => {
    const nc = createNotificationCenter()
    nc.post({ title: 'A' })
    nc.post({ title: 'B' })
    expect(nc.list().map((n) => n.title)).toEqual(['B', 'A'])
  })

  it('does not notify for dismiss no-ops or clearing an empty center', () => {
    const nc = createNotificationCenter()
    const listener = vi.fn()
    nc.subscribe(listener)
    const id = nc.post({ title: 'A' })
    listener.mockClear()

    nc.dismiss('missing')
    expect(listener).not.toHaveBeenCalled()

    nc.dismiss(id)
    listener.mockClear()
    nc.dismissAll()
    expect(listener).not.toHaveBeenCalled()
  })

  it('does not let list or state snapshots mutate the center', () => {
    const nc = createNotificationCenter()
    nc.post({ title: 'A', body: 'body' })

    const listed = nc.list()
    listed[0]!.title = 'changed'
    listed.pop()

    expect(nc.list()[0]).toMatchObject({ title: 'A', body: 'body' })
    expect(Object.isFrozen(nc.getState())).toBe(true)
    expect(Object.isFrozen(nc.getState().notifications)).toBe(true)
    expect(Object.isFrozen(nc.getState().notifications[0])).toBe(true)
  })

  it('normalizes malformed tone and timeout values at the runtime boundary', () => {
    const nc = createNotificationCenter()
    nc.post({ title: 'NaN', tone: 'invalid' as never, timeout: Number.NaN })
    nc.post({ title: 'Infinity', timeout: Number.POSITIVE_INFINITY })
    nc.post({ title: 'negative', timeout: -1 })

    expect(nc.list().map((n) => ({ tone: n.tone, timeout: n.timeout }))).toEqual([
      { tone: 'info', timeout: DEFAULT_NOTIFICATION_TIMEOUT },
      { tone: 'info', timeout: DEFAULT_NOTIFICATION_TIMEOUT },
      { tone: 'info', timeout: DEFAULT_NOTIFICATION_TIMEOUT },
    ])
  })
})
