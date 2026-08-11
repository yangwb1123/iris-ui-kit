/* eslint-disable @typescript-eslint/no-unused-vars -- 远端拆分移入的共享数据 */
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

describe('IrisNavMenu flyouts (A-series, antd parity)', () => {
  it('A2: horizontal branch click toggles the flyout without touching expandedKeys', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const sys = w.find('[data-key="sys"]')
    const children = w.find('[data-iris-nav-children]')

    await sys.trigger('click')
    expect(children.attributes('aria-hidden')).toBeUndefined()
    expect(sys.attributes('aria-expanded')).toBe('true')
    expect(w.emitted('update:expandedKeys')).toBeUndefined()

    await sys.trigger('click')
    expect(children.attributes('aria-hidden')).toBe('true')
    expect(sys.attributes('aria-expanded')).toBe('false')
    expect(w.emitted('update:expandedKeys')).toBeUndefined()
  })

  it('A2: clicking a sibling branch switches the pinned flyout (no double popup)', async () => {
    const horizontalItems: NavNode[] = [
      ...items,
      { key: 'ops', title: 'Operations', children: [{ key: 'jobs', title: 'Jobs' }] },
    ]
    const w = mount(IrisNavMenu, {
      props: { items: horizontalItems, orientation: 'horizontal' },
    })
    const groupOf = (key: string) =>
      w
        .findAll('[data-iris-nav-group]')
        .find((g) => g.element.firstElementChild?.getAttribute('data-key') === key)!

    await w.find('[data-key="sys"]').trigger('click')
    expect(groupOf('sys').attributes('data-open')).toBe('true')

    // Clicking the second branch must visibly switch: ops opens, sys closes.
    await w.find('[data-key="ops"]').trigger('click')
    expect(groupOf('ops').attributes('data-open')).toBe('true')
    expect(groupOf('sys').attributes('data-open')).toBeUndefined()

    await w.find('[data-key="ops"]').trigger('click')
    expect(groupOf('ops').attributes('data-open')).toBeUndefined()
    w.unmount()
  })

  it('A2: hovering a sibling closes a click-pinned flyout (menubar switch)', async () => {
    const horizontalItems: NavNode[] = [
      ...items,
      { key: 'ops', title: 'Operations', children: [{ key: 'jobs', title: 'Jobs' }] },
    ]
    const w = mount(IrisNavMenu, {
      props: { items: horizontalItems, orientation: 'horizontal' },
    })
    const groupOf = (key: string) =>
      w
        .findAll('[data-iris-nav-group]')
        .find((g) => g.element.firstElementChild?.getAttribute('data-key') === key)!

    await w.find('[data-key="sys"]').trigger('click')
    expect(groupOf('sys').attributes('data-open')).toBe('true')

    // Hovering the sibling must not leave two popups open at once.
    await groupOf('ops').trigger('mouseenter')
    await hoverSettle()
    expect(groupOf('ops').attributes('data-open')).toBe('true')
    expect(groupOf('sys').attributes('data-open')).toBeUndefined()
    w.unmount()
  })

  it('A3: Escape closes horizontal flyouts and returns focus to the trigger', async () => {
    const w = mount(IrisNavMenu, {
      props: { items, orientation: 'horizontal' },
      attachTo: document.body,
    })
    const group = w.find('[data-iris-nav-group]')
    await group.trigger('mouseenter')
    await hoverSettle()
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()

    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBe('true')
    expect(document.activeElement?.getAttribute('data-key')).toBe('sys')
    w.unmount()
  })

  it('A4: ArrowDown/ArrowRight open a horizontal flyout and focus its first item', async () => {
    for (const key of ['ArrowDown', 'ArrowRight']) {
      const w = mount(IrisNavMenu, {
        props: { items, orientation: 'horizontal' },
        attachTo: document.body,
      })
      const sys = w.find('[data-key="sys"]')
      ;(sys.element as HTMLElement).focus()
      await w.find('[data-iris-nav-menu]').trigger('keydown', { key })
      expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()
      expect(document.activeElement?.getAttribute('data-key')).toBe('users')
      w.unmount()
    }
  })

  it('A6: branch row stays highlighted while its flyout remains open', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const group = w.find('[data-iris-nav-group]')
    const sys = group.find('[data-iris-nav-item]')
    await group.trigger('mouseenter')
    await hoverSettle()
    expect(sys.classes()).toContain('is-hovered')
    // Pointer moved into the flyout — the trigger row keeps its highlight.
    await sys.trigger('mouseleave')
    expect(sys.classes()).toContain('is-hovered')
    expect(sys.attributes('data-hovered')).toBe('true')
    w.unmount()
  })

  it('A9: collapsed rail pops the submenu flyout on hover', async () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true } })
    const group = w.find('[data-iris-nav-group]')
    const children = group.find('[data-iris-nav-children]')
    expect(children.attributes('aria-hidden')).toBe('true')

    await group.trigger('mouseenter')
    await hoverSettle()
    expect(children.attributes('aria-hidden')).toBeUndefined()
    expect(group.attributes('data-open')).toBe('true')
    expect(group.find('[data-key="users"]').exists()).toBe(true)
    w.unmount()
  })

  it('A9: collapsed flyout is pinned to the viewport (escapes sidebar overflow)', async () => {
    const w = mount(IrisNavMenu, {
      props: { items, collapsed: true },
      attachTo: document.body,
    })
    const group = w.find('[data-iris-nav-group]')
    const trigger = group.find('[data-iris-nav-item]').element as HTMLElement
    // jsdom reports zero rects — stub real geometry so the pinning math is
    // verified (the admin sidebar clips in-flow absolute popups).
    const spy = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      bottom: 154,
      left: 8,
      right: 48,
      width: 40,
      height: 34,
    } as DOMRect)
    await group.trigger('mouseenter')
    await hoverSettle()
    const panel = group.find('[data-iris-nav-children]').element as HTMLElement
    expect(panel.style.position).toBe('fixed')
    expect(panel.style.top).toBe('120px') // aligned with the icon row
    expect(panel.style.left).toBe('48px') // opens right of the icon (LTR)
    spy.mockRestore()
    w.unmount()
  })

  it('horizontal flyouts are pinned below their trigger', async () => {
    const w = mount(IrisNavMenu, {
      props: { items, orientation: 'horizontal' },
      attachTo: document.body,
    })
    const group = w.find('[data-iris-nav-group]')
    const trigger = group.find('[data-iris-nav-item]').element as HTMLElement
    const spy = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 44,
      left: 60,
      right: 140,
      width: 80,
      height: 34,
    } as DOMRect)
    await group.trigger('mouseenter')
    await hoverSettle()
    const panel = group.find('[data-iris-nav-children]').element as HTMLElement
    expect(panel.style.position).toBe('fixed')
    expect(panel.style.top).toBe('44px')
    expect(panel.style.left).toBe('60px')
    spy.mockRestore()
    w.unmount()
  })

  it('scroll/resize listeners are attached only while a flyout is open', async () => {
    const docAdd = vi.spyOn(document, 'addEventListener')
    const docRemove = vi.spyOn(document, 'removeEventListener')
    const winAdd = vi.spyOn(window, 'addEventListener')
    const winRemove = vi.spyOn(window, 'removeEventListener')
    const w = mount(IrisNavMenu, {
      props: { items, orientation: 'horizontal' },
      attachTo: document.body,
    })
    const group = w.find('[data-iris-nav-group]')

    await group.trigger('mouseenter')
    await hoverSettle()
    // scroll listeners go on document (capture — sidebar scroll containers
    // don't bubble); resize listeners go on window.
    expect(docAdd.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(winAdd.mock.calls.some(([type]) => type === 'resize')).toBe(true)

    await group.trigger('mouseleave')
    await closeSettle()
    expect(docRemove.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(winRemove.mock.calls.some(([type]) => type === 'resize')).toBe(true)
    w.unmount()
  })

  it('A4: ArrowUp closes a click-pinned flyout and keeps focus on the trigger', async () => {
    const w = mount(IrisNavMenu, {
      props: { items, orientation: 'horizontal' },
      attachTo: document.body,
    })
    const group = w.find('[data-iris-nav-group]')
    const sys = w.find('[data-key="sys"]')
    await sys.trigger('click')
    expect(group.attributes('data-open')).toBe('true')
    ;(sys.element as HTMLElement).focus()
    await w.find('[data-iris-nav-menu]').trigger('keydown', { key: 'ArrowUp' })
    expect(group.attributes('data-open')).toBeUndefined()
    expect(document.activeElement?.getAttribute('data-key')).toBe('sys')
    w.unmount()
  })

  it('A10: opening a sibling branch closes the previous one without flicker', async () => {
    const horizontalItems: NavNode[] = [
      ...items,
      { key: 'ops', title: 'Operations', children: [{ key: 'jobs', title: 'Jobs' }] },
    ]
    const w = mount(IrisNavMenu, {
      props: { items: horizontalItems, orientation: 'horizontal' },
    })
    const groups = w.findAll('[data-iris-nav-group]')
    const groupFor = (key: string) =>
      groups.find((g) => g.element.firstElementChild?.getAttribute('data-key') === key)!

    await groupFor('sys').trigger('mouseenter')
    await hoverSettle()
    expect(groupFor('sys').attributes('data-open')).toBe('true')

    await groupFor('sys').trigger('mouseleave')
    await groupFor('ops').trigger('mouseenter')
    await closeSettle()
    expect(groupFor('ops').attributes('data-open')).toBe('true')
    expect(groupFor('sys').attributes('data-open')).toBeUndefined()
    w.unmount()
  })

  it('A10: re-entering a branch cancels its pending close', async () => {
    const w = mount(IrisNavMenu, { props: { items, orientation: 'horizontal' } })
    const group = w.find('[data-iris-nav-group]')
    await group.trigger('mouseenter')
    await hoverSettle()
    expect(group.attributes('data-open')).toBe('true')
    await group.trigger('mouseleave')
    await group.trigger('mouseenter')
    await closeSettle()
    expect(group.attributes('data-open')).toBe('true')
    w.unmount()
  })
})
