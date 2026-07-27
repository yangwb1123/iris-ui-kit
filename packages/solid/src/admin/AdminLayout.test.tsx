import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { createTabsNav, type NavNode } from '@iris-ui-kit/core'
import { IrisAdminLayout } from './AdminLayout'

afterEach(cleanup)

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

describe('@iris-ui-kit/solid IrisAdminLayout', () => {
  it('renders the sidebar shell: logo, nav, header bar, content', () => {
    const { container } = render(() => (
      <IrisAdminLayout menus={menus} activeKey="dash">
        {(s) => <main data-page="">{s.activeKey}</main>}
      </IrisAdminLayout>
    ))
    expect(container.querySelector('[data-iris-admin-layout][data-mode="sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-logo]')!.textContent).toContain('Iris Admin')
    expect(container.querySelector('[data-iris-nav-menu]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-headerbar]')).not.toBeNull()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('selecting a nav leaf calls onActiveKeyChange + onSelect and updates content', () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    const { container } = render(() => (
      <IrisAdminLayout
        menus={menus}
        defaultActiveKey="dash"
        onActiveKeyChange={onActiveKeyChange}
        onSelect={onSelect}
      >
        {(s) => <main data-page="">{s.activeKey}</main>}
      </IrisAdminLayout>
    ))
    fireEvent.click(findByText(container, 'System')) // expand
    fireEvent.click(findByText(container, 'Users')) // select
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    expect(onSelect.mock.calls.at(-1)![0]).toBe('users')
    expect(container.querySelector('[data-page]')!.textContent).toBe('users')
  })

  it('collapse toggle calls onCollapsedChange and collapses the nav', () => {
    const onCollapsedChange = vi.fn()
    const { container } = render(() => (
      <IrisAdminLayout menus={menus} activeKey="dash" onCollapsedChange={onCollapsedChange}>
        {() => <main />}
      </IrisAdminLayout>
    ))
    fireEvent.click(container.querySelector('[data-iris-admin-collapse]')!)
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
    expect(container.querySelector('[data-iris-nav-menu][data-collapsed="true"]')).not.toBeNull()
  })

  it('renders the tab bar + opens a tab on navigation; closing syncs active key', () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const { container } = render(() => (
      <IrisAdminLayout menus={menus} defaultActiveKey="dash" tabs={tabs}>
        {(s) => <main data-page="">{s.activeKey}</main>}
      </IrisAdminLayout>
    ))
    expect(container.querySelector('[data-iris-admin-tabs]')).not.toBeNull()
    fireEvent.click(findByText(container, 'System'))
    fireEvent.click(findByText(container, 'Users'))
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(container.querySelector('[data-page]')!.textContent).toBe('users')
    tabs.close('users') // active falls back to dash
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('full-content mode hides chrome', () => {
    const { container } = render(() => (
      <IrisAdminLayout menus={menus} activeKey="dash" mode="full-content">
        {(s) => <main data-page="">{s.activeKey}</main>}
      </IrisAdminLayout>
    ))
    expect(container.querySelector('[data-mode="full-content"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-headerbar]')).toBeNull()
    expect(container.querySelector('[data-iris-nav-menu]')).toBeNull()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('renders horizontal navigation with centered content', () => {
    const { container } = render(() => (
      <IrisAdminLayout
        menus={menus}
        activeKey="dash"
        mode="horizontal"
        menuAlign="center"
        contentWidth="centered"
      >
        {(s) => <main data-page="">{s.activeKey}</main>}
      </IrisAdminLayout>
    ))
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
