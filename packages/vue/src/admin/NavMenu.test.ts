import { describe, expect, it } from 'vitest'
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

  it('keeps expansion history distinct from horizontal visibility and active state', () => {
    const horizontalItems: NavNode[] = [
      ...items,
      {
        key: 'ops',
        title: 'Operations',
        children: [{ key: 'jobs', title: 'Jobs' }],
      },
    ]
    const w = mount(IrisNavMenu, {
      props: {
        items: horizontalItems,
        activeKey: 'users',
        expandedKeys: ['sys', 'ops'],
        orientation: 'horizontal',
      },
    })

    expect(
      w
        .findAll('[data-iris-nav-item][data-active="true"]')
        .map((item) => item.attributes('data-key')),
    ).toEqual(['users'])
    expect(
      w
        .findAll('[data-iris-nav-item][data-active-trail="true"]')
        .map((item) => item.attributes('data-key')),
    ).toEqual(['sys'])
    expect(
      w
        .findAll('[data-iris-nav-item][data-open="true"]')
        .map((item) => item.attributes('data-key')),
    ).toEqual([])
  })

  it('shows a horizontal submenu on hover and keeps it open while leaving the trigger', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const group = w.find('[data-iris-nav-group]')
    const trigger = group.find('[data-iris-nav-item]')
    const children = group.find('[data-iris-nav-children]')

    expect(children.exists()).toBe(true)
    expect(children.attributes('aria-hidden')).toBe('true')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(group.attributes('data-open')).toBeUndefined()

    await group.trigger('mouseenter')
    expect(children.attributes('aria-hidden')).toBeUndefined()
    expect(group.attributes('data-open')).toBe('true')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('mouseleave')
    expect(children.attributes('aria-hidden')).toBeUndefined()
    expect(group.attributes('data-open')).toBe('true')

    await group.trigger('mouseleave')
    expect(children.attributes('aria-hidden')).toBe('true')
    expect(group.attributes('data-open')).toBeUndefined()
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('keeps a submenu open when moving the pointer from trigger into its children area', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const group = w.find('[data-iris-nav-group]')
    const children = group.find('[data-iris-nav-children]')

    await group.trigger('mouseover')
    expect(children.attributes('aria-hidden')).toBeUndefined()

    await group.trigger('mouseout', { relatedTarget: children.element })
    expect(children.attributes('aria-hidden')).toBeUndefined()

    await group.trigger('mouseout', { relatedTarget: document.body })
    expect(children.attributes('aria-hidden')).toBe('true')
  })

  it('closes horizontal menus after selecting a leaf', async () => {
    const w = mount(IrisNavMenu, {
      props: { items: nestedItems, orientation: 'horizontal' },
    })
    const groups = w.findAll('[data-iris-nav-group]')
    const groupFor = (key: string) =>
      groups.find((group) => group.element.firstElementChild?.getAttribute('data-key') === key)!

    await groupFor('sys').trigger('mouseenter')
    await groupFor('admin').trigger('mouseenter')
    expect(w.findAll('[data-iris-nav-item][data-open="true"]')).toHaveLength(2)

    await w.find('[data-key="users"]').trigger('click')
    expect(w.findAll('[data-iris-nav-children][aria-hidden="true"]')).toHaveLength(2)
    expect(w.findAll('[data-iris-nav-item][data-open="true"]')).toHaveLength(0)
    expect(w.emitted('select')![0]).toEqual(['users', nestedItems[0]!.children![0]!.children![0]])
  })

  it('opens nested horizontal branches as right-side flyouts without depth indentation', async () => {
    const w = mount(IrisNavMenu, {
      props: { items: nestedItems, orientation: 'horizontal' },
    })
    const groups = w.findAll('[data-iris-nav-group]')
    const groupFor = (key: string) =>
      groups.find((group) => group.element.firstElementChild?.getAttribute('data-key') === key)!

    await groupFor('sys').trigger('mouseenter')
    await groupFor('admin').trigger('mouseenter')

    const flyout = groupFor('admin').find('[data-iris-nav-children]')
    expect(flyout.classes()).toContain('iris-nav-menu-children')
    expect(groupFor('admin').attributes('data-open')).toBe('true')
    expect(flyout.attributes('aria-hidden')).toBeUndefined()
    expect(w.find('[data-key="admin"]').attributes('data-depth')).toBe('1')
    expect(w.find('[data-key="users"]').attributes('data-depth')).toBe('2')
  })

  it('opens a horizontal submenu for keyboard focus', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const group = w.find('[data-iris-nav-group]')
    const children = group.find('[data-iris-nav-children]')

    await group.trigger('focusin')
    expect(children.attributes('aria-hidden')).toBeUndefined()
    await group.trigger('focusout')
    expect(children.attributes('aria-hidden')).toBe('true')
  })

  it('gives the hovered horizontal branch priority over a previously focused sibling', async () => {
    const horizontalItems: NavNode[] = [
      ...items,
      {
        key: 'ops',
        title: 'Operations',
        children: [{ key: 'jobs', title: 'Jobs' }],
      },
    ]
    const w = mount(IrisNavMenu, {
      props: { items: horizontalItems, orientation: 'horizontal' },
    })
    const groups = w.findAll('[data-iris-nav-group]')
    const groupFor = (key: string) =>
      groups.find((group) => group.element.firstElementChild?.getAttribute('data-key') === key)!

    await groupFor('sys').trigger('focusin')
    await groupFor('ops').trigger('mouseenter')

    expect(
      w
        .findAll('[data-iris-nav-item][data-open="true"]')
        .map((item) => item.attributes('data-key')),
    ).toEqual(['ops'])
  })

  it('uses down arrows only for top-level horizontal branches', () => {
    const horizontal = mount(IrisNavMenu, {
      props: { items: nestedItems, orientation: 'horizontal' },
    })
    const vertical = mount(IrisNavMenu, {
      props: { items: nestedItems, activeKey: 'users', orientation: 'vertical' },
    })

    expect(horizontal.find('[data-key="sys"] [data-iris-icon="chevron-down"]').exists()).toBe(true)
    expect(horizontal.find('[data-key="admin"] [data-iris-icon="chevron-right"]').exists()).toBe(
      true,
    )
    expect(horizontal.find('[data-key="admin"] [data-iris-icon="chevron-down"]').exists()).toBe(
      false,
    )
    expect(vertical.findAll('[data-iris-icon="chevron-right"]')).toHaveLength(2)
    expect(vertical.find('[data-iris-icon="chevron-down"]').exists()).toBe(false)
  })

  it('reverses a branch arrow while active, hovered, open, or on the active trail', async () => {
    const vertical = mount(IrisNavMenu, { props: { items } })
    const branch = vertical.find('[data-key="sys"]')
    const arrow = () => branch.find('.iris-nav-menu-arrow')

    expect(arrow().attributes('data-reversed')).toBeUndefined()
    await branch.trigger('mouseenter')
    expect(arrow().attributes('data-reversed')).toBe('true')
    await branch.trigger('mouseleave')
    expect(arrow().attributes('data-reversed')).toBeUndefined()

    await branch.trigger('click')
    expect(arrow().attributes('data-reversed')).toBe('true')

    const activeBranch = mount(IrisNavMenu, {
      props: { items, activeKey: 'sys' },
    })
    expect(
      activeBranch.find('[data-key="sys"] .iris-nav-menu-arrow').attributes('data-reversed'),
    ).toBe('true')

    const activeTrail = mount(IrisNavMenu, {
      props: { items: nestedItems, activeKey: 'users' },
    })
    expect(
      activeTrail.find('[data-key="sys"] .iris-nav-menu-arrow').attributes('data-reversed'),
    ).toBe('true')
    expect(
      activeTrail.find('[data-key="admin"] .iris-nav-menu-arrow').attributes('data-reversed'),
    ).toBe('true')
  })

  it('keeps a horizontal arrow reversed while its hover flyout remains visible', async () => {
    const w = mount(IrisNavMenu, {
      props: { items: nestedItems, orientation: 'horizontal' },
    })
    const group = w.find('[data-iris-nav-group]')
    const arrow = () => group.find('.iris-nav-menu-arrow')

    expect(arrow().attributes('data-reversed')).toBeUndefined()
    await group.trigger('mouseenter')
    expect(arrow().attributes('data-reversed')).toBe('true')
    await group.find('[data-iris-nav-item]').trigger('mouseleave')
    expect(arrow().attributes('data-reversed')).toBe('true')
    await group.trigger('mouseleave')
    expect(arrow().attributes('data-reversed')).toBeUndefined()
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
    const [dash, sys, disabled] = w.findAll('[data-iris-nav-item]')

    await dash!.trigger('mouseenter')

    expect(dash!.classes()).toContain('is-hovered')
    expect(sys!.classes()).not.toContain('is-hovered')

    await disabled!.trigger('mouseenter')
    expect(disabled!.classes()).not.toContain('is-hovered')
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

  it('Arrow Right expands a collapsed branch, Arrow Left collapses it', async () => {
    const w = mount(IrisNavMenu, { props: { items }, attachTo: document.body })
    const sys = w.findAll('[data-iris-nav-item]').find((b) => b.text().includes('System'))!
    ;(sys.element as HTMLElement).focus()
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(true)
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
    w.unmount()
  })

  it('Home / End jump to the first / last visible item', async () => {
    const w = mount(IrisNavMenu, { props: { items }, attachTo: document.body })
    const buttons = w.findAll('[data-iris-nav-item]')
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
