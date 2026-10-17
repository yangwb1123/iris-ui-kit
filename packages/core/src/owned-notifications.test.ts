import { describe, expect, it, vi } from 'vitest'
import { createNotificationCenter } from './notifications'
import { createOwnedNotificationCenter } from './owned-notifications'
import type { OwnedNotificationView } from './internal/owned-notification-state'

const namesOf = (view: OwnedNotificationView) => view.notifications.map((n) => n.title).join('|')
const postSticky = (center: ReturnType<typeof createOwnedNotificationCenter>, title: string) =>
  center.post({ title, timeout: 0 })

function thrown(action: () => void, expected: unknown) {
  let caught: unknown
  try {
    action()
  } catch (error) {
    caught = error
  }
  expect(caught).toBe(expected)
}

describe('owned notification center (opt-in public entry)', () => {
  it('E01 exposes a frozen readonly facade with no writable capabilities', () => {
    const center = createOwnedNotificationCenter()
    expect(Object.isFrozen(center)).toBe(true)
    expect(Reflect.ownKeys(center).sort()).toEqual([
      'dismiss',
      'dismissAll',
      'exportRecords',
      'getState',
      'importRecords',
      'post',
      'store',
      'subscribe',
    ])
    expect(Object.isFrozen(center.store)).toBe(true)
    expect(
      'setState' in center.store || 'batch' in center.store || 'subscribeWith' in center.store,
    ).toBe(false)
    expect('list' in center).toBe(false)
  })

  it('E02 every factory call owns an independent epoch', () => {
    const a = createOwnedNotificationCenter()
    const b = createOwnedNotificationCenter()
    const seen = vi.fn()
    a.subscribe(seen)
    postSticky(a, 'A')
    expect(namesOf(b.getState())).toBe('')
    expect(seen).toHaveBeenCalledTimes(1)
    postSticky(b, 'B')
    expect(namesOf(a.getState())).toBe('A')
    expect(namesOf(b.getState())).toBe('B')
  })

  it('E03 posts newest-first into a frozen view with a stable revision identity', () => {
    const center = createOwnedNotificationCenter()
    const first = center.getState()
    expect(center.getState()).toBe(first)
    const id = postSticky(center, 'one')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    const view = center.getState()
    expect(view).not.toBe(first)
    expect(view.revision).toBe(first.revision + 1)
    expect(Object.isFrozen(view)).toBe(true)
    expect(Object.isFrozen(view.notifications)).toBe(true)
    expect(view.notifications.map((n) => n.title)).toEqual(['one'])
  })

  it('E04 runtime admission refuses invalid posts without committing', () => {
    const center = createOwnedNotificationCenter()
    for (const invalid of [{ title: 1 }, { title: 'x', unknownField: true }, null, 'text']) {
      expect(() => center.post(invalid as never)).toThrow(TypeError)
    }
    const revision = center.getState().revision
    const id = center.post({ title: 'normalized', tone: 'error' as never })
    expect(center.getState().notifications[0]!.id).toBe(id)
    expect(center.getState().notifications[0]!.tone).toBe('info')
    expect(center.getState().revision).toBe(revision + 1)
  })

  it('E05 dismiss and dismissAll are no-ops when nothing matches', () => {
    const center = createOwnedNotificationCenter()
    const revision = center.getState().revision
    center.dismiss('missing')
    center.dismissAll()
    expect(center.getState().revision).toBe(revision)
  })

  it('E06 dismiss removes one id and dismissAll clears', () => {
    const center = createOwnedNotificationCenter()
    const id = postSticky(center, 'one')
    postSticky(center, 'two')
    center.dismiss(id)
    expect(center.getState().notifications.map((n) => n.title)).toEqual(['two'])
    center.dismissAll()
    expect(center.getState().notifications).toEqual([])
  })

  it('E07 import/export round-trips and refuses duplicate or invalid records', () => {
    const center = createOwnedNotificationCenter()
    postSticky(center, 'one')
    const records = center.exportRecords()
    expect(records[0]!.title).toBe('one')
    const other = createOwnedNotificationCenter()
    other.importRecords(records)
    expect(other.getState().notifications.map((n) => n.title)).toEqual(['one'])
    expect(() => other.importRecords([...records, { ...records[0]! }])).toThrow(TypeError)
    expect(() => other.importRecords([{ ...records[0]!, tone: 'error' }])).toThrow(TypeError)
    expect(other.getState().notifications.map((n) => n.title)).toEqual(['one'])
  })

  it('E08 export is a fresh mutable copy that cannot write back', () => {
    const center = createOwnedNotificationCenter()
    postSticky(center, 'one')
    const records = center.exportRecords()
    records[0]!.title = 'changed'
    records[0]!.tone = 'danger'
    expect(center.getState().notifications[0]!.title).toBe('one')
  })

  it('E09 wake-ups carry the current snapshot after captured-outer reentry', () => {
    const center = createOwnedNotificationCenter()
    let nested = false
    const seen: string[] = []
    center.subscribe(() => {
      if (!nested) {
        nested = true
        postSticky(center, 'inner')
      }
    })
    center.subscribe((view) => seen.push(namesOf(view)))
    postSticky(center, 'outer')
    expect(seen).toEqual(['inner|outer', 'inner|outer'])
    expect(namesOf(center.getState())).toBe('inner|outer')
  })

  it('E10 duplicate listeners dedupe through the source set and detach safely', () => {
    const center = createOwnedNotificationCenter()
    const seen = vi.fn()
    const off1 = center.subscribe(seen)
    const off2 = center.subscribe(seen)
    postSticky(center, 'one')
    expect(seen).toHaveBeenCalledTimes(1)
    off1()
    postSticky(center, 'two')
    expect(seen).toHaveBeenCalledTimes(1)
    off2()
    const detached = center.subscribe
    detached(seen)
    postSticky(center, 'three')
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it('E11 invalid listeners refuse before any registration', () => {
    const center = createOwnedNotificationCenter()
    for (const invalid of [undefined, null, 0, {}]) {
      expect(() => Reflect.apply(center.subscribe, undefined, [invalid as never])).toThrow(
        TypeError,
      )
    }
  })

  it('E12 listener failures are fail-fast postcommit and never replayed', () => {
    const center = createOwnedNotificationCenter()
    const error = { kind: 'listener failure' }
    const later = vi.fn()
    center.subscribe(() => {
      throw error
    })
    const off = center.subscribe(later)
    thrown(() => postSticky(center, 'committed'), error)
    expect(namesOf(center.getState())).toBe('committed')
    expect(later).not.toHaveBeenCalled()
    off()
  })

  it('E13 legacy factory keeps its writable store, list() copies and defaults', () => {
    const legacy = createNotificationCenter()
    legacy.store.setState({ notifications: [] })
    expect(legacy.getState().notifications).toEqual([])
    const id = legacy.post({ title: 'legacy' })
    const copy = legacy.list()
    copy[0]!.title = 'mutated'
    expect(legacy.getState().notifications[0]!.title).toBe('legacy')
    expect(legacy.getState().notifications[0]!.id).toBe(id)
  })
})
