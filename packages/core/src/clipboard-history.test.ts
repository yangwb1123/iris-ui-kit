import { describe, it, expect } from 'vitest'
import { createClipboardHistory, DEFAULT_CLIPBOARD_MAX } from './clipboard-history'

describe('createClipboardHistory', () => {
  it('adds newest-first, ignores empty, dedupes by moving to front', () => {
    const c = createClipboardHistory()
    c.add('one')
    c.add('two')
    expect(c.add('   ')).toBeNull() // empty ignored
    expect(c.list().map((e) => e.text)).toEqual(['two', 'one'])
    const id = c.add('one') // re-copy moves to front, no duplicate
    expect(c.list().map((e) => e.text)).toEqual(['one', 'two'])
    expect(c.list()).toHaveLength(2)
    expect(id).toBe(c.list()[0]!.id) // returns the (reused) id
  })

  it('caps to max, evicting oldest unpinned first', () => {
    const c = createClipboardHistory({ max: 3 })
    c.add('a')
    c.add('b')
    c.add('c')
    c.add('d') // evicts 'a'
    expect(c.list().map((e) => e.text)).toEqual(['d', 'c', 'b'])
    expect(DEFAULT_CLIPBOARD_MAX).toBe(20)
  })

  it('pins survive cap eviction and clear', () => {
    const c = createClipboardHistory({ max: 2 })
    const a = c.add('a')!
    c.togglePin(a) // pin 'a'
    c.add('b')
    c.add('c') // would push out 'a', but it's pinned → evict unpinned 'b' instead
    expect(
      c
        .list()
        .map((e) => e.text)
        .sort(),
    ).toEqual(['a', 'c'])
    c.clear() // keeps pinned only
    expect(c.list().map((e) => e.text)).toEqual(['a'])
  })

  it('remove + togglePin', () => {
    const c = createClipboardHistory()
    const a = c.add('a')!
    const b = c.add('b')!
    c.togglePin(b)
    expect(c.list().find((e) => e.id === b)!.pinned).toBe(true)
    c.togglePin(b)
    expect(c.list().find((e) => e.id === b)!.pinned).toBe(false)
    c.remove(a)
    expect(c.list().map((e) => e.text)).toEqual(['b'])
  })
})
