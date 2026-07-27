import { describe, it, expect } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import { createNotificationCenter, notificationsPlugin, notificationTokens } from './index'

describe('createNotificationCenter', () => {
  it('push adds an unread notification newest-first and returns its id', () => {
    const c = createNotificationCenter()
    const id1 = c.push({ title: 'First' })
    c.push({ title: 'Second', tone: 'success' })
    expect(c.getState().items.map((n) => n.title)).toEqual(['Second', 'First'])
    expect(c.getState().items.every((n) => !n.read)).toBe(true)
    expect(c.unreadCount()).toBe(2)
    expect(typeof id1).toBe('string')
  })

  it('markRead / markAllRead update unread count', () => {
    const c = createNotificationCenter()
    const id = c.push({ title: 'A' })
    c.push({ title: 'B' })
    c.markRead(id)
    expect(c.unreadCount()).toBe(1)
    c.markAllRead()
    expect(c.unreadCount()).toBe(0)
  })

  it('dismiss removes one, clear removes all', () => {
    const c = createNotificationCenter()
    const id = c.push({ title: 'A' })
    c.push({ title: 'B' })
    c.dismiss(id)
    expect(c.getState().items.map((n) => n.title)).toEqual(['B'])
    c.clear()
    expect(c.getState().items).toEqual([])
  })

  it('caps history at max (oldest dropped)', () => {
    const c = createNotificationCenter({ max: 2 })
    c.push({ title: 'A' })
    c.push({ title: 'B' })
    c.push({ title: 'C' })
    expect(c.getState().items.map((n) => n.title)).toEqual(['C', 'B'])
  })

  it('seeds from initial + plugin registers tokens', () => {
    const c = createNotificationCenter({ initial: [{ title: 'Welcome' }] })
    expect(c.getState().items).toHaveLength(1)
    const { tokens } = runPlugins([notificationsPlugin])
    expect(tokens['--iris-notification-gap']).toBe(notificationTokens['--iris-notification-gap'])
  })
})
