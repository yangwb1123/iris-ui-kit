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

describe('IrisNavMenu interactions (A-series, antd parity)', () => {
  it('A1: expands the active branch trail when items arrive asynchronously', async () => {
    const w = mount(IrisNavMenu, { props: { items: [] as NavNode[], activeKey: 'users' } })
    expect(w.find('[data-iris-nav-children]').exists()).toBe(false)
    await w.setProps({ items })
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()
    expect(w.find('[data-key="users"]').attributes('data-active')).toBe('true')
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
    await hoverSettle()
    expect(children.attributes('aria-hidden')).toBeUndefined()
    expect(group.attributes('data-open')).toBe('true')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('mouseleave')
    expect(children.attributes('aria-hidden')).toBeUndefined()
    expect(group.attributes('data-open')).toBe('true')

    await group.trigger('mouseleave')
    await closeSettle()
    expect(children.attributes('aria-hidden')).toBe('true')
    expect(group.attributes('data-open')).toBeUndefined()
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('keeps a submenu open when moving the pointer from trigger into its children area', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const group = w.find('[data-iris-nav-group]')
    const children = group.find('[data-iris-nav-children]')

    await group.trigger('mouseover')
    await hoverSettle()
    expect(children.attributes('aria-hidden')).toBeUndefined()

    await group.trigger('mouseout', { relatedTarget: children.element })
    expect(children.attributes('aria-hidden')).toBeUndefined()

    await group.trigger('mouseout', { relatedTarget: document.body })
    await closeSettle()
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
    await hoverSettle()
    await groupFor('admin').trigger('mouseenter')
    await hoverSettle()
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
    await hoverSettle()
    await groupFor('admin').trigger('mouseenter')
    await hoverSettle()

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
    await hoverSettle()

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
    await hoverSettle()
    expect(arrow().attributes('data-reversed')).toBe('true')
    await group.find('[data-iris-nav-item]').trigger('mouseleave')
    expect(arrow().attributes('data-reversed')).toBe('true')
    await group.trigger('mouseleave')
    await closeSettle()
    expect(arrow().attributes('data-reversed')).toBeUndefined()
  })

  it('A7: scrolls the active item into view when the active key changes', async () => {
    const scrollIntoView = vi.fn()
    if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
      ;(HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrollIntoView
    }
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView)
    const w = mount(IrisNavMenu, {
      props: { items, activeKey: 'dash', defaultExpandedKeys: ['sys'] },
    })
    spy.mockClear()
    await w.setProps({ activeKey: 'users' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toMatchObject({ block: 'nearest', inline: 'nearest' })
    spy.mockRestore()
    w.unmount()
  })

  it('A8: vertical children stay in the DOM and animate height', () => {
    const w = mount(IrisNavMenu, { props: { items } })
    const children = w.find('[data-iris-nav-children]')
    expect(children.exists()).toBe(true)
    expect(children.attributes('aria-hidden')).toBe('true')
    const css = document.querySelector(`#${__NAV_MENU_STYLE_ID}`)!.textContent!
    expect(css).toContain('grid-template-rows: 0fr')
    expect(css).toContain('grid-template-rows: 1fr')
    w.unmount()
  })
})
