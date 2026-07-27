import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createTabsNav, type NavNode } from '@iris-ui-kit/core'
import { __resetBreadcrumbStyles } from '../primitives/breadcrumb/styles'
import AdminLayoutHarness from './AdminLayoutHarness.svelte'

afterEach(() => {
  cleanup()
  __resetBreadcrumbStyles()
})

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

const navItems = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))
const findByText = (c: HTMLElement, text: string) =>
  navItems(c).find((b) => b.textContent!.includes(text))!

describe('@iris-ui-kit/svelte IrisAdminLayout', () => {
  it('renders the sidebar shell: logo, nav, header bar, content', () => {
    const { container } = render(AdminLayoutHarness, { props: { menus, activeKey: 'dash' } })
    expect(container.querySelector('[data-iris-admin-layout][data-mode="sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-logo]')!.textContent).toContain('Iris Admin')
    expect(container.querySelector('[data-iris-nav-menu]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-headerbar]')).not.toBeNull()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('selecting a nav leaf calls onActiveKeyChange + onSelect and updates content', async () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    const { container } = render(AdminLayoutHarness, {
      props: { menus, defaultActiveKey: 'dash', onActiveKeyChange, onSelect },
    })
    await fireEvent.click(findByText(container, 'System')) // expand
    await fireEvent.click(findByText(container, 'Users')) // select
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    expect(onSelect.mock.calls.at(-1)![0]).toBe('users')
    expect(container.querySelector('[data-page]')!.textContent).toBe('users')
  })

  it('collapse toggle calls onCollapsedChange and collapses the nav', async () => {
    const onCollapsedChange = vi.fn()
    const { container } = render(AdminLayoutHarness, {
      props: { menus, activeKey: 'dash', onCollapsedChange },
    })
    await fireEvent.click(container.querySelector('[data-iris-admin-collapse]')!)
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
    expect(container.querySelector('[data-iris-nav-menu][data-collapsed="true"]')).not.toBeNull()
  })

  it('renders the tab bar + opens a tab on navigation; closing syncs active key', async () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const { container } = render(AdminLayoutHarness, {
      props: { menus, defaultActiveKey: 'dash', tabs },
    })
    expect(container.querySelector('[data-iris-admin-tabs]')).not.toBeNull()
    await fireEvent.click(findByText(container, 'System'))
    await fireEvent.click(findByText(container, 'Users'))
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(container.querySelector('[data-page]')!.textContent).toBe('users')
    tabs.close('users') // active falls back to dash
    flushSync()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('full-content mode hides chrome', () => {
    const { container } = render(AdminLayoutHarness, {
      props: { menus, activeKey: 'dash', mode: 'full-content' },
    })
    expect(container.querySelector('[data-mode="full-content"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-headerbar]')).toBeNull()
    expect(container.querySelector('[data-iris-nav-menu]')).toBeNull()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('renders horizontal navigation with centered content', () => {
    const { container } = render(AdminLayoutHarness, {
      props: {
        menus,
        activeKey: 'dash',
        mode: 'horizontal',
        menuAlign: 'center',
        contentWidth: 'centered',
      },
    })
    expect(
      container.querySelector('[data-iris-admin-layout][data-mode="horizontal"]'),
    ).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-topnav]')).not.toBeNull()
    expect(
      container.querySelector('[data-iris-nav-menu][data-orientation="horizontal"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-iris-admin-content][data-width="centered"]'),
    ).not.toBeNull()
  })
})
