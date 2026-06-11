import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createTabsNav, type NavNode } from '@iris-ui/core'
import AdminShellProbe from './AdminShellProbe.svelte'
import type { UseAdminShellReturn } from './useAdminShell.svelte'

afterEach(cleanup)

const menus: NavNode[] = [
  { key: 'dash', title: 'Dashboard', icon: 'home' },
  {
    key: 'sys',
    title: 'System',
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles' },
    ],
  },
]

const active = (c: HTMLElement) => c.querySelector('[data-active]')!.textContent
const trail = (c: HTMLElement) => c.querySelector('[data-trail]')!.textContent

describe('useAdminShell (svelte)', () => {
  it('uncontrolled: navigate on a leaf updates active key + fires callbacks', () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    let api: UseAdminShellReturn | undefined
    const { container } = render(AdminShellProbe, {
      props: {
        menus,
        defaultActiveKey: 'dash',
        onActiveKeyChange,
        onSelect,
        onready: (a: UseAdminShellReturn) => {
          api = a
        },
      },
    })
    expect(active(container)).toBe('dash')
    api!.navigate({ key: 'roles', title: 'Roles' })
    flushSync()
    expect(active(container)).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
    expect(onSelect.mock.calls.at(-1)).toEqual(['roles', expect.objectContaining({ key: 'roles' })])
  })

  it('navigate on a branch redirects to its first leaf', () => {
    let api: UseAdminShellReturn | undefined
    const { container } = render(AdminShellProbe, {
      props: {
        menus,
        defaultActiveKey: 'dash',
        onready: (a: UseAdminShellReturn) => {
          api = a
        },
      },
    })
    api!.navigate(menus[1]) // System (branch)
    flushSync()
    expect(active(container)).toBe('users')
  })

  it('controlled: active key follows the prop, navigate still fires onActiveKeyChange', async () => {
    const onActiveKeyChange = vi.fn()
    let api: UseAdminShellReturn | undefined
    const { container, rerender } = render(AdminShellProbe, {
      props: {
        menus,
        activeKey: 'dash',
        onActiveKeyChange,
        onready: (a: UseAdminShellReturn) => {
          api = a
        },
      },
    })
    expect(active(container)).toBe('dash')
    api!.navigate({ key: 'users', title: 'Users' })
    flushSync()
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    // Controlled: render still reflects the prop until the parent writes it back.
    expect(active(container)).toBe('dash')
    await rerender({ menus, activeKey: 'users', onActiveKeyChange })
    expect(active(container)).toBe('users')
  })

  it('navigate opens a tab in the shared store', () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    let api: UseAdminShellReturn | undefined
    render(AdminShellProbe, {
      props: {
        menus,
        defaultActiveKey: 'dash',
        tabs,
        onready: (a: UseAdminShellReturn) => {
          api = a
        },
      },
    })
    api!.navigate({ key: 'users', title: 'Users' })
    flushSync()
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(tabs.getState().activeKey).toBe('users')
  })

  it('syncFromTab reconciles the active key (e.g. a tab close picked a neighbor)', () => {
    const onActiveKeyChange = vi.fn()
    let api: UseAdminShellReturn | undefined
    const { container } = render(AdminShellProbe, {
      props: {
        menus,
        defaultActiveKey: 'dash',
        onActiveKeyChange,
        onready: (a: UseAdminShellReturn) => {
          api = a
        },
      },
    })
    api!.syncFromTab('roles')
    flushSync()
    expect(active(container)).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
  })

  it('breadcrumb returns the ancestor trail of the active key', () => {
    let api: UseAdminShellReturn | undefined
    const { container } = render(AdminShellProbe, {
      props: {
        menus,
        defaultActiveKey: 'dash',
        onready: (a: UseAdminShellReturn) => {
          api = a
        },
      },
    })
    api!.navigate({ key: 'users', title: 'Users' })
    flushSync()
    expect(trail(container)).toBe('sys,users')
  })
})
