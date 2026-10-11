import { describe, expect, it, vi } from 'vitest'
import { createNotificationCenter, type NotificationCenterState } from './notifications'

// Observe real freeze operations without replacing notification work.
describe('notification snapshot ownership and structural sharing', () => {
  it('freezes new records once rather than refreezing all earlier records on every post', () => {
    const center = createNotificationCenter()
    const freeze = vi.spyOn(Object, 'freeze')
    try {
      for (let i = 0; i < 100; i++) center.post({ title: String(i) })
      expect(freeze.mock.calls.length).toBeLessThanOrEqual(400)
      expect(center.list().map((item) => item.title)).toEqual(
        Array.from({ length: 100 }, (_, i) => String(99 - i)),
      )
    } finally {
      freeze.mockRestore()
    }
  })

  it('keeps retained snapshots frozen and unchanged across reentrant post and dismiss', () => {
    const center = createNotificationCenter()
    const snapshots: NotificationCenterState[] = []
    let nested = false
    center.subscribe((state) => {
      snapshots.push(state)
      if (!nested) {
        nested = true
        center.post({ title: 'nested' })
      }
    })
    const first = center.post({ title: 'first' })
    center.dismiss(first)
    expect(snapshots.map((state) => state.notifications.map((item) => item.title))).toEqual([
      ['first'],
      ['nested', 'first'],
      ['nested'],
    ])
    for (const state of snapshots) {
      expect(Object.isFrozen(state)).toBe(true)
      expect(Object.isFrozen(state.notifications)).toBe(true)
      for (const item of state.notifications) expect(Object.isFrozen(item)).toBe(true)
    }
    const listed = center.list()
    listed[0]!.title = 'outside'
    expect(center.list()[0]!.title).toBe('nested')
  })

  it.each(['post', 'dismiss'] as const)(
    'binds %s ownership to the exact list read from an alternating state getter',
    (operation) => {
      let title = 'original'
      const center = createNotificationCenter()
      const first = center.post({ title: 'first' })
      const removed = center.post({ title: 'removed' })
      const owned = center.getState().notifications
      const foreign = [
        ...owned,
        Object.freeze({
          id: 'foreign',
          get title() {
            return title
          },
          tone: 'info' as const,
          timeout: 0,
        }),
      ]
      let reads = 0
      center.store.setState({
        get notifications() {
          reads++
          // post checks the first list; dismiss has a separate no-op precheck.
          return operation === 'post'
            ? reads === 1
              ? owned
              : foreign
            : reads === 3
              ? owned
              : foreign
        },
      })
      if (operation === 'post') center.post({ title: 'new' })
      else center.dismiss(removed)
      title = 'outside'
      const records = center.list()
      expect(records.map((item) => item.title)).toEqual(
        operation === 'post' ? ['new', 'removed', 'first'] : ['first', 'original'],
      )
      expect(records.some((item) => item.id === first)).toBe(true)
      if (operation === 'dismiss') expect(records.some((item) => item.id === removed)).toBe(false)
    },
  )

  it('does not grant ownership to lists returned by a foreign filter/map override', () => {
    let title = 'original'
    const center = createNotificationCenter()
    const foreign = Object.freeze({
      id: 'foreign',
      get title() {
        return title
      },
      tone: 'info' as const,
      timeout: 0,
    })
    const filtered = [foreign]
    filtered.map = (() => [foreign]) as typeof filtered.map
    const injected = [foreign, { ...foreign, id: 'removed' }]
    injected.filter = (() => filtered) as typeof injected.filter
    center.store.setState({ notifications: injected })
    center.dismiss('removed')
    center.post({ title: 'new' })
    title = 'outside'
    expect(center.list().map((item) => item.title)).toEqual(['new', 'original'])
    expect(
      Object.getOwnPropertyDescriptor(center.getState().notifications[1], 'title')?.get,
    ).toBeUndefined()
  })

  it('still copies foreign frozen accessor records injected through the public writable store', () => {
    let title = 'original'
    const center = createNotificationCenter()
    const foreign = Object.freeze({
      id: 'foreign',
      get title() {
        return title
      },
      tone: 'info' as const,
      timeout: 0,
    })
    center.store.setState({ notifications: [foreign] })
    center.post({ title: 'new' })
    title = 'outside'
    expect(center.list().map((item) => item.title)).toEqual(['new', 'original'])
    expect(center.getState().notifications[1]).not.toBe(foreign)
  })
})
