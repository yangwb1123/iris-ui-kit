import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createTabsNav } from '@iris-ui-kit/core'
import { IrisAdminTabs } from './AdminTabs'

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('IrisAdminTabs', () => {
  it('renders a chip per open tab and marks the active one', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    const w = mount(IrisAdminTabs, { props: { nav } })
    const chips = w.findAll('[data-iris-tab]')
    expect(chips).toHaveLength(2)
    const active = w.find('[data-iris-tab][data-active="true"]')
    expect(active.text()).toContain('A')
  })

  it('marks the trailing actions trigger for host layout styling', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    const w = mount(IrisAdminTabs, { props: { nav } })

    expect(w.find('[data-iris-tab-actions]').exists()).toBe(true)
    expect(w.find('[data-iris-tab-actions]').attributes('aria-label')).toBeTruthy()
  })

  it('clicking a tab activates it and emits change', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const w = mount(IrisAdminTabs, { props: { nav } })
    const labels = w.findAll('[data-iris-tab-label]')
    await labels[0]!.trigger('click') // activate A
    expect(nav.getState().activeKey).toBe('a')
    expect(w.emitted('change')![0]).toEqual(['a'])
  })

  it('the × closes a tab (and stops activation)', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const w = mount(IrisAdminTabs, { props: { nav } })
    await w.findAll('[data-iris-tab-close]')[1]!.trigger('click') // close B
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['a'])
    expect(w.emitted('close')![0]).toEqual(['b'])
  })

  it('pinned tabs render without a close button', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    const w = mount(IrisAdminTabs, { props: { nav } })
    // only the closable 'a' tab has a close button
    expect(w.findAll('[data-iris-tab-close]')).toHaveLength(1)
  })

  it('opens a localized context menu at the tab under the pointer', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    const target = w.findAll('[data-iris-tab]')[0]!
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
    })

    target.element.dispatchEvent(event)
    await settle()

    const menu = document.querySelector('[data-iris-admin-tab-context-menu]') as HTMLElement | null
    expect(event.defaultPrevented).toBe(true)
    expect(menu).not.toBeNull()
    expect(menu?.parentElement).toBe(document.body)
    expect(menu?.style.transform).toContain('translate3d(120px, 80px')
    expect(menu?.textContent).toContain('Refresh')
    expect(
      menu?.querySelector('[data-iris-admin-tab-context-menu-item="closeLeft"]'),
    ).not.toBeNull()
    // A context gesture targets a tab without changing the active tab.
    expect(nav.getState().activeKey).toBe('b')
    w.unmount()
  })

  it('applies context actions to the tab that was right-clicked', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    const target = w.findAll('[data-iris-tab]')[0]!

    target.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 80,
      }),
    )
    await nextTick()
    const refresh = document.querySelector(
      '[data-iris-admin-tab-context-menu-item="refresh"]',
    ) as HTMLButtonElement | null
    expect(refresh).not.toBeNull()
    refresh?.click()
    await nextTick()

    expect(nav.getState().versions).toEqual({ a: 1, b: 0 })
    expect(document.querySelector('[data-iris-admin-tab-context-menu]')).toBeNull()

    target.element.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 80,
      }),
    )
    await nextTick()
    const closeRight = document.querySelector(
      '[data-iris-admin-tab-context-menu-item="closeRight"]',
    ) as HTMLButtonElement | null
    expect(closeRight).not.toBeNull()
    closeRight?.click()
    await nextTick()

    expect(nav.getState().tabs.map((tab) => tab.key)).toEqual(['a'])
    expect(nav.getState().activeKey).toBe('a')
    w.unmount()
  })

  it('shows and clears hover feedback for context-menu actions', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })

    await w.find('[data-iris-tab]').trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    const refresh = document.querySelector(
      '[data-iris-admin-tab-context-menu-item="refresh"]',
    ) as HTMLButtonElement
    // The menu focuses its first action on open; blur it so this assertion
    // covers pointer hover rather than the focus surface.
    refresh.blur()
    refresh.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    await nextTick()
    expect(refresh.style.background).toBe('var(--iris-surface-hover)')

    refresh.dispatchEvent(new Event('pointerleave', { bubbles: true }))
    await nextTick()
    expect(refresh.style.background).toBe('transparent')
    w.unmount()
  })

  it('supports nested tab actions and configurable keyboard shortcuts', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const w = mount(IrisAdminTabs, {
      props: {
        nav,
        shortcuts: { closeRight: 'Alt+R' },
      },
      attachTo: document.body,
    })

    await w.findAll('[data-iris-tab]')[0]!.trigger('contextmenu', {
      clientX: 10,
      clientY: 10,
    })
    await settle()
    const group = document.querySelector(
      '[data-iris-admin-tab-context-menu-group="close-group"]',
    ) as HTMLButtonElement
    const submenu = document.querySelector('[data-iris-admin-tab-context-submenu]') as HTMLElement
    expect(submenu.getAttribute('aria-hidden')).toBe('true')
    group.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    await nextTick()
    expect(submenu.getAttribute('aria-hidden')).toBe('false')
    expect(
      document.querySelector(
        '[data-iris-admin-tab-context-menu-item="closeRight"] [data-iris-admin-tab-context-menu-shortcut]',
      )?.textContent,
    ).toContain('Alt+R')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true }))
    await nextTick()
    expect(nav.getState().tabs.map((tab) => tab.key)).toEqual(['a'])
    expect(document.querySelector('[data-iris-admin-tab-context-menu]')).toBeNull()
    w.unmount()
  })

  it('dismisses the context menu on Escape and outside pointer-down', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    const target = w.find('[data-iris-tab]')

    await target.trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    expect(document.querySelector('[data-iris-admin-tab-context-menu]')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(document.querySelector('[data-iris-admin-tab-context-menu]')).toBeNull()

    await target.trigger('contextmenu', { clientX: 10, clientY: 10 })
    await settle()
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(document.querySelector('[data-iris-admin-tab-context-menu]')).toBeNull()
    w.unmount()
  })

  it('supports menu keyboard navigation and skips disabled actions', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })

    await w.findAll('[data-iris-tab]')[0]!.trigger('contextmenu', {
      clientX: 10,
      clientY: 10,
    })
    await settle()
    const menu = document.querySelector('[data-iris-admin-tab-context-menu]') as HTMLElement
    const refresh = menu.querySelector('[data-iris-admin-tab-context-menu-item="refresh"]')!
    const close = menu.querySelector('[data-iris-admin-tab-context-menu-item="close"]')!
    const closeLeft = menu.querySelector('[data-iris-admin-tab-context-menu-item="closeLeft"]')!
    expect(document.activeElement).toBe(refresh)
    refresh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(close)
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).not.toBe(closeLeft)
    w.unmount()
  })

  it('disables destructive context actions when the tab cannot close', async () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    nav.open({ key: 'a', title: 'A' })
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    const pinned = w.findAll('[data-iris-tab]')[0]!

    pinned.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    await nextTick()
    const close = document.querySelector(
      '[data-iris-admin-tab-context-menu-item="close"]',
    ) as HTMLButtonElement | null
    expect(close?.disabled).toBe(true)
    expect(nav.getState().tabs.map((tab) => tab.key)).toEqual(['home', 'a'])
    w.unmount()
  })

  it('reacts to external store mutations', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    const w = mount(IrisAdminTabs, { props: { nav } })
    expect(w.findAll('[data-iris-tab]')).toHaveLength(1)
    nav.open({ key: 'b', title: 'B' })
    await w.vm.$nextTick()
    expect(w.findAll('[data-iris-tab]')).toHaveLength(2)
  })

  it('only the active tab is in the tab order (roving tabindex)', () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' }) // active
    const w = mount(IrisAdminTabs, { props: { nav } })
    const labels = w.findAll('[data-iris-tab-label]')
    expect(labels[0]!.attributes('tabindex')).toBe('-1')
    expect(labels[1]!.attributes('tabindex')).toBe('0')
    expect(labels[1]!.attributes('aria-selected')).toBe('true')
  })

  it('Arrow Right / Left + Home / End move + activate tabs', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    nav.open({ key: 'c', title: 'C' }) // active = c
    const w = mount(IrisAdminTabs, { props: { nav } })
    const tablist = w.find('[role="tablist"]')
    await tablist.trigger('keydown', { key: 'ArrowRight' }) // wraps c → a
    expect(nav.getState().activeKey).toBe('a')
    await tablist.trigger('keydown', { key: 'ArrowLeft' }) // a → c
    expect(nav.getState().activeKey).toBe('c')
    await tablist.trigger('keydown', { key: 'Home' })
    expect(nav.getState().activeKey).toBe('a')
    await tablist.trigger('keydown', { key: 'End' })
    expect(nav.getState().activeKey).toBe('c')
    expect(w.emitted('change')).toBeTruthy()
  })

  it('× on a non-active tab restores focus to the active label', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    nav.open({ key: 'c', title: 'C' }) // active = c
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    await w.findAll('[data-iris-tab-close]')[0]!.trigger('click') // close A
    await w.vm.$nextTick()
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['b', 'c'])
    expect(nav.getState().activeKey).toBe('c')
    expect(document.activeElement).toBe(w.find('[data-iris-tab-label][data-key="c"]').element)
    w.unmount()
  })

  it('× on the active tab restores focus to the new active label', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    nav.open({ key: 'c', title: 'C' }) // active = c
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    await w.findAll('[data-iris-tab-close]')[2]!.trigger('click') // close C
    await w.vm.$nextTick()
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['a', 'b'])
    expect(nav.getState().activeKey).toBe('b')
    expect(document.activeElement).toBe(w.find('[data-iris-tab-label][data-key="b"]').element)
    w.unmount()
  })

  it('roving keyboard nav stays reachable after a mouse close', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' })
    nav.open({ key: 'c', title: 'C' }) // active = c
    const w = mount(IrisAdminTabs, { props: { nav }, attachTo: document.body })
    await w.findAll('[data-iris-tab-close]')[2]!.trigger('click') // close C → active = b
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('[data-iris-tab-label][data-key="b"]').element)
    // keydown must originate from the focused element and bubble to the tablist
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    await w.vm.$nextTick()
    expect(nav.getState().activeKey).toBe('a') // wraps b → a
    expect(w.emitted('change')!.at(-1)).toEqual(['a'])
    w.unmount()
  })

  it('Delete closes the focused tab', async () => {
    const nav = createTabsNav()
    nav.open({ key: 'a', title: 'A' })
    nav.open({ key: 'b', title: 'B' }) // active
    const w = mount(IrisAdminTabs, { props: { nav } })
    await w.find('[role="tablist"]').trigger('keydown', { key: 'Delete' })
    expect(nav.getState().tabs.map((x) => x.key)).toEqual(['a'])
    expect(w.emitted('close')!.at(-1)).toEqual(['b'])
  })
})
