import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createTabsNav } from '@iris-ui/core'
import { IrisAdminTabs } from './AdminTabs'

afterEach(cleanup)

const tabsEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-iris-tab]'))

describe('IrisAdminTabs (react)', () => {
  it('renders a chip per open tab and marks the active one', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    const { container } = render(<IrisAdminTabs nav={nav} />)
    expect(tabsEls(container)).toHaveLength(2)
    expect(container.querySelector('[data-iris-tab][data-active="true"]')!.textContent).toContain(
      'A',
    )
  })

  it('clicking a tab activates it and calls onChange', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const onChange = vi.fn()
    const { container } = render(<IrisAdminTabs nav={nav} onChange={onChange} />)
    fireEvent.click(container.querySelectorAll('[data-iris-tab-label]')[0]!) // A
    expect(nav.getState().activeKey).toBe('a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('the × closes a tab (and stops activation)', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const onClose = vi.fn()
    const { container } = render(<IrisAdminTabs nav={nav} onClose={onClose} />)
    fireEvent.click(container.querySelectorAll('[data-iris-tab-close]')[1]!) // close B
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['a'])
    expect(onClose).toHaveBeenCalledWith('b')
  })

  it('pinned tabs render without a close button', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    const { container } = render(<IrisAdminTabs nav={nav} />)
    expect(container.querySelectorAll('[data-iris-tab-close]')).toHaveLength(1)
  })

  it('reacts to external store mutations', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    const { container } = render(<IrisAdminTabs nav={nav} />)
    expect(tabsEls(container)).toHaveLength(1)
    act(() => nav.open({ key: 'b', title: 'B' }))
    expect(tabsEls(container)).toHaveLength(2)
  })

  it('only the active tab is in the tab order (roving tabindex)', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' }) // active
    const { container } = render(<IrisAdminTabs nav={nav} />)
    const labels = container.querySelectorAll<HTMLElement>('[data-iris-tab-label]')
    expect(labels[0]!.getAttribute('tabindex')).toBe('-1')
    expect(labels[1]!.getAttribute('tabindex')).toBe('0')
    expect(labels[1]!.getAttribute('aria-selected')).toBe('true')
  })

  it('Arrow Right / Left + Home / End move + activate tabs', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    nav.open({ key: 'c', title: 'C' }) // active = c
    const { container } = render(<IrisAdminTabs nav={nav} />)
    const tablist = container.querySelector('[role="tablist"]')!
    act(() => fireEvent.keyDown(tablist, { key: 'ArrowRight' })) // c → a (wrap)
    expect(nav.getState().activeKey).toBe('a')
    act(() => fireEvent.keyDown(tablist, { key: 'ArrowLeft' })) // a → c
    expect(nav.getState().activeKey).toBe('c')
    act(() => fireEvent.keyDown(tablist, { key: 'Home' }))
    expect(nav.getState().activeKey).toBe('a')
    act(() => fireEvent.keyDown(tablist, { key: 'End' }))
    expect(nav.getState().activeKey).toBe('c')
  })

  it('Delete closes the focused tab', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' }) // active
    const onClose = vi.fn()
    const { container } = render(<IrisAdminTabs nav={nav} onClose={onClose} />)
    act(() => fireEvent.keyDown(container.querySelector('[role="tablist"]')!, { key: 'Delete' }))
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['a'])
    expect(onClose).toHaveBeenCalledWith('b')
  })
})
