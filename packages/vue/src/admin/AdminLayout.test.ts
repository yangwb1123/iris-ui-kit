import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { createTabsNav, type NavNode } from '@iris-ui/core'
import { IrisAdminLayout } from './AdminLayout'

const menus: NavNode[] = [
  { key: 'dash', title: 'Dashboard', icon: 'menu' },
  {
    key: 'sys',
    title: 'System',
    icon: 'folder',
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles' },
    ],
  },
]

const slots = { default: (p: { activeKey: string }) => h('main', { 'data-page': '' }, p.activeKey) }

describe('IrisAdminLayout', () => {
  it('renders the sidebar shell: logo, nav, header bar, content', () => {
    const w = mount(IrisAdminLayout, { props: { menus, activeKey: 'dash' }, slots })
    expect(w.find('[data-iris-admin-layout][data-mode="sidebar"]').exists()).toBe(true)
    expect(w.find('[data-iris-admin-logo]').text()).toContain('Iris Admin')
    expect(w.find('[data-iris-nav-menu]').exists()).toBe(true)
    expect(w.find('[data-iris-admin-headerbar]').exists()).toBe(true)
    expect(w.find('[data-page]').text()).toBe('dash')
  })

  it('selecting a nav leaf emits update:activeKey + select', async () => {
    const w = mount(IrisAdminLayout, { props: { menus, activeKey: 'dash' }, slots })
    // open System branch, then click Users
    const branch = w.findAll('[data-iris-nav-item]').find((b) => b.text().includes('System'))!
    await branch.trigger('click')
    const users = w.findAll('[data-iris-nav-item]').find((b) => b.text().includes('Users'))!
    await users.trigger('click')
    expect(w.emitted('update:activeKey')!.at(-1)).toEqual(['users'])
    expect(w.emitted('select')!.at(-1)![0]).toBe('users')
  })

  it('the collapse toggle emits update:collapsed and collapses the nav', async () => {
    const w = mount(IrisAdminLayout, { props: { menus, activeKey: 'dash' }, slots })
    await w.find('[data-iris-admin-collapse]').trigger('click')
    expect(w.emitted('update:collapsed')!.at(-1)).toEqual([true])
    expect(w.find('[data-iris-nav-menu][data-collapsed="true"]').exists()).toBe(true)
  })

  it('renders the tab bar and opens a tab when navigating', async () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const w = mount(IrisAdminLayout, { props: { menus, activeKey: 'dash', tabs }, slots })
    expect(w.find('[data-iris-admin-tabs]').exists()).toBe(true)
    const branch = w.findAll('[data-iris-nav-item]').find((b) => b.text().includes('System'))!
    await branch.trigger('click')
    const users = w.findAll('[data-iris-nav-item]').find((b) => b.text().includes('Users'))!
    await users.trigger('click')
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(tabs.getState().activeKey).toBe('users')
  })

  it('syncs activeKey when a tab is closed via the store', async () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard' }] })
    const w = mount(IrisAdminLayout, { props: { menus, tabs }, slots })
    tabs.open({ key: 'users', title: 'Users' })
    await w.vm.$nextTick()
    expect(w.find('[data-page]').text()).toBe('users')
    tabs.close('users') // active falls back to 'dash'
    await w.vm.$nextTick()
    expect(w.emitted('update:activeKey')!.at(-1)).toEqual(['dash'])
  })

  it('full-content mode renders only the page content', () => {
    const w = mount(IrisAdminLayout, {
      props: { menus, activeKey: 'dash', mode: 'full-content' },
      slots,
    })
    expect(w.find('[data-mode="full-content"]').exists()).toBe(true)
    expect(w.find('[data-iris-admin-headerbar]').exists()).toBe(false)
    expect(w.find('[data-iris-nav-menu]').exists()).toBe(false)
    expect(w.find('[data-page]').text()).toBe('dash')
  })

  it('renders the toolbar slot in the header', () => {
    const w = mount(IrisAdminLayout, {
      props: { menus, activeKey: 'dash' },
      slots: { ...slots, toolbar: () => h('button', { 'data-tool': '' }, 'Theme') },
    })
    expect(w.find('[data-iris-admin-toolbar] [data-tool]').exists()).toBe(true)
  })
})
