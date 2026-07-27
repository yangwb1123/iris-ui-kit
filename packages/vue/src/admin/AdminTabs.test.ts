import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTabsNav } from '@iris-ui-kit/core'
import { IrisAdminTabs } from './AdminTabs'

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
