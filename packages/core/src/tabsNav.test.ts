import { describe, expect, it, vi } from 'vitest'
import { createTabsNav, type TabItem } from './tabsNav'

const tab = (key: string, extra: Partial<TabItem> = {}): TabItem => ({
  key,
  title: key.toUpperCase(),
  ...extra,
})

describe('createTabsNav', () => {
  it('seeds tabs + active key and defaults closable', () => {
    const n = createTabsNav({ tabs: [tab('home', { pinned: true }), tab('a')] })
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['home', 'a'])
    expect(n.getState().activeKey).toBe('a') // last seeded
    expect(n.getState().tabs[1]!.closable).toBe(true)
  })

  it('open appends + activates; re-open activates and refreshes meta', () => {
    const n = createTabsNav()
    n.open(tab('a'))
    n.open(tab('b'))
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['a', 'b'])
    expect(n.getState().activeKey).toBe('b')

    n.open({ key: 'a', title: 'A2', icon: 'star' })
    expect(n.getState().activeKey).toBe('a')
    expect(n.getState().tabs).toHaveLength(2)
    expect(n.getState().tabs.find((t) => t.key === 'a')!.title).toBe('A2')
  })

  it('close activates the right neighbor, then the left when none', () => {
    const n = createTabsNav()
    n.open(tab('a'))
    n.open(tab('b'))
    n.open(tab('c'))
    n.activate('b')
    n.close('b')
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['a', 'c'])
    expect(n.getState().activeKey).toBe('c') // right neighbor

    n.close('c')
    expect(n.getState().activeKey).toBe('a') // left neighbor
  })

  it('closing an inactive tab keeps the active one', () => {
    const n = createTabsNav()
    n.open(tab('a'))
    n.open(tab('b'))
    n.activate('a')
    n.close('b')
    expect(n.getState().activeKey).toBe('a')
  })

  it('pinned / non-closable tabs ignore close and survive closeOthers/closeAll', () => {
    const n = createTabsNav({ tabs: [tab('home', { pinned: true })] })
    n.open(tab('a'))
    n.open(tab('b'))
    n.close('home')
    expect(n.getState().tabs.map((t) => t.key)).toContain('home')

    n.closeOthers('a')
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['home', 'a'])
    expect(n.getState().activeKey).toBe('a')

    n.closeAll()
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['home'])
    expect(n.getState().activeKey).toBe('home')
  })

  it('closeLeft / closeRight prune by position, keeping pinned', () => {
    const n = createTabsNav({ tabs: [tab('home', { pinned: true })] })
    n.open(tab('a'))
    n.open(tab('b'))
    n.open(tab('c'))
    n.closeLeft('b') // removes 'a' (home pinned stays)
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['home', 'b', 'c'])
    n.closeRight('b') // removes 'c'
    expect(n.getState().tabs.map((t) => t.key)).toEqual(['home', 'b'])
  })

  it('refresh bumps the version and changes the cache key', () => {
    const n = createTabsNav()
    n.open(tab('a'))
    expect(n.cacheKey('a')).toBe('a:0')
    n.refresh('a')
    expect(n.cacheKey('a')).toBe('a:1')
    expect(n.cacheKeys()).toEqual(['a:1'])
  })

  it('setPinned toggles pinned state', () => {
    const n = createTabsNav()
    n.open(tab('a'))
    n.setPinned('a', true)
    expect(n.getState().tabs[0]!.pinned).toBe(true)
    n.close('a')
    expect(n.getState().tabs).toHaveLength(1) // pinned, ignored
  })

  it('notifies subscribers on change', () => {
    const n = createTabsNav()
    const seen = vi.fn()
    const unsub = n.subscribe(seen)
    n.open(tab('a'))
    expect(seen).toHaveBeenCalledTimes(1)
    unsub()
    n.open(tab('b'))
    expect(seen).toHaveBeenCalledTimes(1)
  })
})
