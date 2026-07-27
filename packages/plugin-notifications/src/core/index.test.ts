import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  createMemoryNotificationStorage,
  createNotificationCenter,
  notificationsPlugin,
  notificationMessages,
  notificationTokens,
} from './index'

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
    const { tokens, messages } = runPlugins([notificationsPlugin])
    expect(tokens['--iris-notification-gap']).toBe(notificationTokens['--iris-notification-gap'])
    expect(messages['en-US']).toEqual(notificationMessages)
  })

  it('persists and hydrates through an injected storage', () => {
    const storage = createMemoryNotificationStorage()
    const first = createNotificationCenter({ storage })
    const id = first.push({ title: 'Saved', tone: 'success' })
    first.markRead(id)

    const second = createNotificationCenter({ storage })
    expect(second.getState().items).toEqual([
      expect.objectContaining({ id, title: 'Saved', tone: 'success', read: true }),
    ])
  })

  it('hydrates on demand and applies max to stored history', () => {
    const storage = createMemoryNotificationStorage()
    const writer = createNotificationCenter({ storage })
    writer.push({ title: 'A' })
    writer.push({ title: 'B' })

    const reader = createNotificationCenter({ storage, max: 1 })
    expect(reader.getState().items.map((item) => item.title)).toEqual(['B'])
    writer.push({ title: 'C' })
    expect(reader.hydrate()).toBe(true)
    expect(reader.getState().items.map((item) => item.title)).toEqual(['C'])
  })

  it('ignores corrupt and version-mismatched snapshots without throwing', () => {
    const storage = createMemoryNotificationStorage({
      broken: '{not json',
      future: JSON.stringify({ version: 99, items: [] }),
    })
    expect(() =>
      createNotificationCenter({
        storage,
        storageKey: 'broken',
        initial: [{ title: 'Fallback' }],
      }),
    ).not.toThrow()
    const center = createNotificationCenter({
      storage,
      storageKey: 'future',
      initial: [{ title: 'Fallback' }],
    })
    expect(center.getState().items[0]?.title).toBe('Fallback')
  })

  it('tolerates unavailable storage and reports failed explicit persistence', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    const center = createNotificationCenter({ storage, initial: [{ title: 'Memory fallback' }] })
    expect(center.getState().items[0]?.title).toBe('Memory fallback')
    expect(center.persist()).toBe(false)
    expect(() => center.push({ title: 'Still works' })).not.toThrow()
  })

  it('subscribe notifies on state changes', () => {
    const c = createNotificationCenter()
    const listener = vi.fn()
    c.subscribe(listener)
    c.push({ title: 'X' })
    expect(listener).toHaveBeenCalled()
  })

  it('handles empty initial state', () => {
    const c = createNotificationCenter()
    expect(c.getState().items).toEqual([])
    expect(c.unreadCount()).toBe(0)
  })

  it('push with tone defaults to undefined', () => {
    const c = createNotificationCenter()
    const id = c.push({ title: 'Test' })
    const item = c.getState().items.find((n) => n.id === id)
    expect(item?.tone).toBeUndefined()
  })
})
