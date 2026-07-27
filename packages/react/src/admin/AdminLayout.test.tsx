import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

const page = (state: { activeKey: string }) => <main data-page="">{state.activeKey}</main>
const navItems = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))

describe('IrisAdminLayout (react)', () => {
  it('renders the sidebar shell: logo, nav, header bar, content', () => {
    const { container } = render(
      <IrisAdminLayout menus={menus} activeKey="dash">
        {page}
      </IrisAdminLayout>,
    )
    expect(container.querySelector('[data-iris-admin-layout][data-mode="sidebar"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-logo]')!.textContent).toContain('Iris Admin')
    expect(container.querySelector('[data-iris-nav-menu]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-headerbar]')).not.toBeNull()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('selecting a nav leaf calls onActiveKeyChange + onSelect', () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    const { container } = render(
      <IrisAdminLayout
        menus={menus}
        defaultActiveKey="dash"
        onActiveKeyChange={onActiveKeyChange}
        onSelect={onSelect}
      >
        {page}
      </IrisAdminLayout>,
    )
    fireEvent.click(navItems(container).find((b) => b.textContent!.includes('System'))!)
    fireEvent.click(navItems(container).find((b) => b.textContent!.includes('Users'))!)
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    expect(onSelect.mock.calls.at(-1)![0]).toBe('users')
    expect(container.querySelector('[data-page]')!.textContent).toBe('users')
  })

  it('the collapse toggle calls onCollapsedChange and collapses the nav', () => {
    const onCollapsedChange = vi.fn()
    const { container } = render(
      <IrisAdminLayout menus={menus} activeKey="dash" onCollapsedChange={onCollapsedChange}>
        {page}
      </IrisAdminLayout>,
    )
    fireEvent.click(container.querySelector('[data-iris-admin-collapse]')!)
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
    expect(container.querySelector('[data-iris-nav-menu][data-collapsed="true"]')).not.toBeNull()
  })

  it('renders the tab bar and opens a tab when navigating', () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const { container } = render(
      <IrisAdminLayout menus={menus} defaultActiveKey="dash" tabs={tabs}>
        {page}
      </IrisAdminLayout>,
    )
    expect(container.querySelector('[data-iris-admin-tabs]')).not.toBeNull()
    fireEvent.click(navItems(container).find((b) => b.textContent!.includes('System'))!)
    fireEvent.click(navItems(container).find((b) => b.textContent!.includes('Users'))!)
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(tabs.getState().activeKey).toBe('users')
  })

  it('syncs active key when a tab is closed via the store', () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard' }] })
    const onActiveKeyChange = vi.fn()
    const { container } = render(
      <IrisAdminLayout
        menus={menus}
        defaultActiveKey="dash"
        tabs={tabs}
        onActiveKeyChange={onActiveKeyChange}
      >
        {page}
      </IrisAdminLayout>,
    )
    act(() => tabs.open({ key: 'users', title: 'Users' }))
    expect(container.querySelector('[data-page]')!.textContent).toBe('users')
    act(() => tabs.close('users')) // active falls back to 'dash'
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('dash')
  })

  it('full-content mode renders only the page content', () => {
    const { container } = render(
      <IrisAdminLayout menus={menus} activeKey="dash" mode="full-content">
        {page}
      </IrisAdminLayout>,
    )
    expect(container.querySelector('[data-mode="full-content"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-admin-headerbar]')).toBeNull()
    expect(container.querySelector('[data-iris-nav-menu]')).toBeNull()
    expect(container.querySelector('[data-page]')!.textContent).toBe('dash')
  })

  it('renders the toolbar in the header', () => {
    const { container } = render(
      <IrisAdminLayout menus={menus} activeKey="dash" toolbar={<button data-tool="">Theme</button>}>
        {page}
      </IrisAdminLayout>,
    )
    expect(container.querySelector('[data-iris-admin-toolbar] [data-tool]')).not.toBeNull()
  })
})
