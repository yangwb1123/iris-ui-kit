import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisNavMenu } from './NavMenu'
import type { NavNode } from '@iris-ui-kit/core'
import { __NAV_MENU_STYLE_ID, __resetNavMenuStyles } from './styles'

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

const nestedItems: NavNode[] = [
  {
    key: 'sys',
    title: 'System',
    children: [
      {
        key: 'admin',
        title: 'Administration',
        children: [{ key: 'users', title: 'Users' }],
      },
    ],
  },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Longer than the flyout hover-open delay (100ms). */
const hoverSettle = () => wait(120)
/** Longer than the flyout hover-close delay (150ms). */
const closeSettle = () => wait(180)

describe('IrisNavMenu', () => {
  it('renders top-level items; branches collapsed by default', () => {
    const w = mount(IrisNavMenu, { props: { items } })
    const all = w.findAll('[data-iris-nav-item]')
    // A8: children are always in the DOM (hidden), not rendered on demand.
    expect(all).toHaveLength(4)
    expect(all.filter((b) => !b.element.closest('[aria-hidden="true"]'))).toHaveLength(2)
    const children = w.find('[data-iris-nav-children]')
    expect(children.exists()).toBe(true)
    expect(children.attributes('aria-hidden')).toBe('true')
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
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()
    expect(w.findAll('[data-iris-nav-item]')).toHaveLength(4) // dash, sys, users, roles
    expect(w.emitted('select')).toBeUndefined()
    await sys.trigger('click')
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBe('true')
  })

  it('auto-expands the active branch trail and marks the active leaf', () => {
    const w = mount(IrisNavMenu, { props: { items, activeKey: 'users' } })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(true)
    const active = w
      .findAll('[data-iris-nav-item]')
      .filter((b) => b.attributes('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0]!.text()).toContain('Users')
    expect(active[0]!.attributes('aria-current')).toBe('page')

    const trail = w
      .findAll('[data-iris-nav-item]')
      .filter((b) => b.attributes('data-active-trail') === 'true')
    expect(trail).toHaveLength(1)
    expect(trail[0]!.attributes('data-key')).toBe('sys')
    expect(trail[0]!.attributes('aria-current')).toBeUndefined()
  })

  it('installs class-based arrow motion once with reduced-motion support', () => {
    __resetNavMenuStyles()
    const first = mount(IrisNavMenu, { props: { items } })
    const second = mount(IrisNavMenu, { props: { items } })
    const styles = document.querySelectorAll(`#${__NAV_MENU_STYLE_ID}`)

    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain(":where(.iris-nav-menu-arrow[data-reversed='true'])")
    expect(styles[0]?.textContent).toContain('transform: rotate(180deg)')
    expect(styles[0]?.textContent).toContain('prefers-reduced-motion: reduce')

    first.unmount()
    second.unmount()
  })

  it('applies the hover token only to an enabled hovered item', async () => {
    const w = mount(IrisNavMenu, {
      props: {
        items: [...items, { key: 'disabled', title: 'Disabled', disabled: true }],
      },
    })
    const dash = w.find('[data-key="dash"]')
    const sys = w.find('[data-key="sys"]')
    const disabled = w.find('[data-key="disabled"]')

    await dash.trigger('mouseenter')

    expect(dash.classes()).toContain('is-hovered')
    expect(sys.classes()).not.toContain('is-hovered')

    await disabled.trigger('mouseenter')
    expect(disabled.classes()).not.toContain('is-hovered')
  })

  it('active item stays active and gains is-hovered on hover (active-hover feedback)', async () => {
    const w = mount(IrisNavMenu, {
      props: { items, activeKey: 'dash' },
    })
    const active = w.find('[data-key="dash"]')
    expect(active.attributes('data-active')).toBe('true')

    await active.trigger('mouseenter')
    // hover 类照常加上；data-active 保持——CSS 规则
    // [data-active=true]:hover 提供加深背景（styles.ts）
    expect(active.classes()).toContain('is-hovered')
    expect(active.attributes('data-active')).toBe('true')

    await active.trigger('mouseleave')
    expect(active.classes()).not.toContain('is-hovered')
    expect(active.attributes('data-active')).toBe('true')
  })

  it('renders a badge for a leaf with badge', async () => {
    const w = mount(IrisNavMenu, { props: { items, activeKey: 'users' } })
    expect(w.find('[data-iris-nav-badge]').text()).toBe('3')
  })

  it('collapsed mode renders an icon rail with titles; flyouts hidden until hover', () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true } })
    const all = w.findAll('[data-iris-nav-item]')
    // A9: submenu children are always in the DOM inside hidden flyouts.
    expect(all).toHaveLength(4)
    expect(all[1]!.attributes('title')).toBe('System')
    expect(all[1]!.attributes('aria-label')).toBe('System (section)')
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBe('true')
    expect(w.find('[data-iris-nav-group]').attributes('data-open')).toBeUndefined()
  })

  it('collapsed branch click jumps to its first leaf', async () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true } })
    await w.findAll('[data-iris-nav-item]')[1]!.trigger('click') // System → first leaf Users
    expect(w.emitted('select')![0]).toEqual(['users', items[1]!.children![0]])
  })

  it('supports controlled expandedKeys via v-model', async () => {
    const w = mount(IrisNavMenu, { props: { items, expandedKeys: [] } })
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBe('true')
    await w.findAll('[data-iris-nav-item]')[1]!.trigger('click')
    expect(w.emitted('update:expandedKeys')![0]).toEqual([['sys']])
    // still controlled → no children until parent updates the prop
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBe('true')
    await w.setProps({ expandedKeys: ['sys'] })
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()
  })

  it('does not select a disabled leaf', async () => {
    const w = mount(IrisNavMenu, {
      props: { items: [{ key: 'x', title: 'X', disabled: true }] as NavNode[] },
    })
    await w.find('[data-iris-nav-item]').trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })

  it('Arrow Down / Up move focus between visible items', async () => {
    const w = mount(IrisNavMenu, { props: { items }, attachTo: document.body })
    const buttons = w.findAll('[data-iris-nav-item]')
    ;(buttons[0]!.element as HTMLElement).focus()
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    w.unmount()
  })

  it('Arrow Right expands a collapsed branch and steps in; Arrow Left collapses it', async () => {
    const w = mount(IrisNavMenu, { props: { items }, attachTo: document.body })
    const sys = w.findAll('[data-iris-nav-item]').find((b) => b.text().includes('System'))!
    ;(sys.element as HTMLElement).focus()
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()
    // A5: focus steps into the first child.
    expect(document.activeElement?.getAttribute('data-key')).toBe('users')
    // ArrowLeft from a child returns to the branch (still open).
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement?.getAttribute('data-key')).toBe('sys')
    // ArrowLeft on the open branch collapses it.
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBe('true')
    w.unmount()
  })

  it('Home / End jump to the first / last visible item', async () => {
    const w = mount(IrisNavMenu, { props: { items }, attachTo: document.body })
    const buttons = w
      .findAll('[data-iris-nav-item]')
      .filter((b) => !b.element.closest('[aria-hidden="true"]'))
    ;(buttons[0]!.element as HTMLElement).focus()
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(buttons[buttons.length - 1]!.element)
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    w.unmount()
  })

  it('collapsed branches announce themselves as sections', () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true } })
    const sys = w.findAll('[data-iris-nav-item]')[1]!
    expect(sys.attributes('aria-label')).toBe('System (section)')
  })
})
