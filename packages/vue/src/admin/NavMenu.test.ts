import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisNavMenu } from './NavMenu'
import type { NavNode } from '@iris-ui/core'

const items: NavNode[] = [
  { key: 'dash', title: 'Dashboard', icon: 'menu' },
  {
    key: 'sys',
    title: 'System',
    icon: 'folder',
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles', badge: 3 },
    ],
  },
]

describe('IrisNavMenu', () => {
  it('renders top-level items; branches collapsed by default', () => {
    const w = mount(IrisNavMenu, { props: { items } })
    const tops = w.findAll('[data-iris-nav-item]')
    expect(tops).toHaveLength(2)
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
  })

  it('clicking a leaf emits select(key, node)', async () => {
    const w = mount(IrisNavMenu, { props: { items } })
    await w.findAll('[data-iris-nav-item]')[0]!.trigger('click')
    expect(w.emitted('select')![0]).toEqual(['dash', items[0]])
  })

  it('clicking a branch toggles its children (does not select)', async () => {
    const w = mount(IrisNavMenu, { props: { items } })
    const sys = w.findAll('[data-iris-nav-item]')[1]!
    await sys.trigger('click')
    expect(w.find('[data-iris-nav-children]').exists()).toBe(true)
    expect(w.findAll('[data-iris-nav-item]')).toHaveLength(4) // dash, sys, users, roles
    expect(w.emitted('select')).toBeUndefined()
    await sys.trigger('click')
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
  })

  it('auto-expands the active branch trail and marks the active leaf', () => {
    const w = mount(IrisNavMenu, { props: { items, activeKey: 'users' } })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(true)
    const active = w
      .findAll('[data-iris-nav-item]')
      .find((b) => b.attributes('data-active') === 'true')
    expect(active!.text()).toContain('Users')
    expect(active!.attributes('aria-current')).toBe('page')
  })

  it('renders a badge for a leaf with badge', async () => {
    const w = mount(IrisNavMenu, { props: { items, activeKey: 'users' } })
    expect(w.find('[data-iris-nav-badge]').text()).toBe('3')
  })

  it('collapsed mode renders only top-level icon buttons with titles', () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true } })
    const tops = w.findAll('[data-iris-nav-item]')
    expect(tops).toHaveLength(2)
    expect(tops[1]!.attributes('title')).toBe('System')
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
  })

  it('collapsed branch click jumps to its first leaf', async () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true } })
    await w.findAll('[data-iris-nav-item]')[1]!.trigger('click') // System → first leaf Users
    expect(w.emitted('select')![0]).toEqual(['users', items[1]!.children![0]])
  })

  it('supports controlled expandedKeys via v-model', async () => {
    const w = mount(IrisNavMenu, { props: { items, expandedKeys: [] } })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
    await w.findAll('[data-iris-nav-item]')[1]!.trigger('click')
    expect(w.emitted('update:expandedKeys')![0]).toEqual([['sys']])
    // still controlled → no children until parent updates the prop
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
    await w.setProps({ expandedKeys: ['sys'] })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(true)
  })

  it('does not select a disabled leaf', async () => {
    const w = mount(IrisNavMenu, {
      props: { items: [{ key: 'x', title: 'X', disabled: true }] as NavNode[] },
    })
    await w.find('[data-iris-nav-item]').trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })
})
