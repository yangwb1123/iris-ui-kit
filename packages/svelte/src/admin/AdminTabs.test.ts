import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createTabsNav } from '@iris-ui/core'
import IrisAdminTabs from './AdminTabs.svelte'

afterEach(cleanup)

const tabsEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-iris-tab]'))

describe('@iris-ui/svelte IrisAdminTabs', () => {
  it('renders a chip per open tab and marks the active one', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    const { container } = render(IrisAdminTabs, { props: { nav } })
    expect(tabsEls(container)).toHaveLength(2)
    expect(container.querySelector('[data-iris-tab][data-active="true"]')!.textContent).toContain(
      'A',
    )
  })

  it('clicking a tab activates it + onChange; × closes; pinned has no ×', async () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const onChange = vi.fn()
    const onClose = vi.fn()
    const { container } = render(IrisAdminTabs, { props: { nav, onChange, onClose } })
    const labels = container.querySelectorAll<HTMLElement>('[data-iris-tab-label]')
    await fireEvent.click(labels[1]!) // activate A
    expect(nav.getState().activeKey).toBe('a')
    expect(onChange).toHaveBeenCalledWith('a')
    // pinned 'home' has no close button → only a + b closable
    expect(container.querySelectorAll('[data-iris-tab-close]')).toHaveLength(2)
    await fireEvent.click(container.querySelectorAll<HTMLElement>('[data-iris-tab-close]')[1]!) // close B
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['home', 'a'])
    expect(onClose).toHaveBeenCalledWith('b')
  })

  it('roving tabindex: only the active tab is tabbable', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' }) // active
    const { container } = render(IrisAdminTabs, { props: { nav } })
    const labels = container.querySelectorAll<HTMLElement>('[data-iris-tab-label]')
    expect(labels[0]!.getAttribute('tabindex')).toBe('-1')
    expect(labels[1]!.getAttribute('tabindex')).toBe('0')
  })

  it('Arrow keys + Home/End move + activate; Delete closes focused', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    nav.open({ key: 'c', title: 'C' }) // active = c
    const { container } = render(IrisAdminTabs, { props: { nav } })
    const tablist = container.querySelector('[role="tablist"]')!
    await fireEvent.keyDown(tablist, { key: 'ArrowRight' }) // c → a (wrap)
    expect(nav.getState().activeKey).toBe('a')
    await fireEvent.keyDown(tablist, { key: 'End' })
    expect(nav.getState().activeKey).toBe('c')
    await fireEvent.keyDown(tablist, { key: 'Home' })
    expect(nav.getState().activeKey).toBe('a')
    await fireEvent.keyDown(tablist, { key: 'Delete' })
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['b', 'c'])
  })

  it('reacts to external store mutations', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    const { container } = render(IrisAdminTabs, { props: { nav } })
    expect(tabsEls(container)).toHaveLength(1)
    nav.open({ key: 'b', title: 'B' })
    flushSync()
    expect(tabsEls(container)).toHaveLength(2)
  })
})
