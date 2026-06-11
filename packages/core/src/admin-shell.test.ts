import { describe, it, expect, vi } from 'vitest'
import { createAdminShell } from './admin-shell'
import type { NavNode } from './nav'

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

describe('createAdminShell', () => {
  it('navigate on a leaf sets active and opens a tab', () => {
    const shell = createAdminShell({ menus })
    shell.navigate(menus[0])
    expect(shell.getActiveKey()).toBe('dash')
    expect(shell.tabs.getState().tabs.map((t) => t.key)).toEqual(['dash'])
    expect(shell.tabs.getState().activeKey).toBe('dash')
  })

  it('navigate on a branch redirects to its first leaf', () => {
    const shell = createAdminShell({ menus })
    shell.navigate(menus[1]) // System (branch)
    expect(shell.getActiveKey()).toBe('users')
    expect(shell.tabs.getState().tabs.map((t) => t.key)).toEqual(['users'])
  })

  it('onActiveChange fires with the resolved node', () => {
    const onActiveChange = vi.fn()
    const shell = createAdminShell({ menus, onActiveChange })
    shell.navigate(menus[1])
    expect(onActiveChange).toHaveBeenCalledWith('users', expect.objectContaining({ key: 'users' }))
  })

  it('syncFromTab reconciles active key and is loop-guarded', () => {
    const onActiveChange = vi.fn()
    const shell = createAdminShell({ menus, onActiveChange })
    shell.navigate(menus[0]) // dash active
    onActiveChange.mockClear()
    shell.syncFromTab('dash') // same key → guarded no-op
    expect(onActiveChange).not.toHaveBeenCalled()
    shell.syncFromTab('roles') // different → reconcile
    expect(shell.getActiveKey()).toBe('roles')
  })

  it('breadcrumb returns the ancestor trail of the active key', () => {
    const shell = createAdminShell({ menus })
    shell.navigate({ key: 'users', title: 'Users' })
    expect(shell.breadcrumb().map((n) => n.key)).toEqual(['sys', 'users'])
  })

  it('closing the active tab activates a neighbor (via the shared tabs store)', () => {
    const shell = createAdminShell({ menus })
    shell.navigate(menus[0]) // dash
    shell.navigate({ key: 'users', title: 'Users' }) // users active, two tabs
    shell.tabs.close('users')
    expect(shell.tabs.getState().activeKey).toBe('dash')
  })

  it('setMenus updates the tree used by breadcrumb + syncFromTab node lookup', () => {
    const onActiveChange = vi.fn()
    const shell = createAdminShell({ menus, onActiveChange })
    const nextMenus: NavNode[] = [
      { key: 'dash', title: 'Dashboard' },
      { key: 'reports', title: 'Reports', children: [{ key: 'sales', title: 'Sales' }] },
    ]
    shell.setMenus(nextMenus)
    shell.syncFromTab('sales')
    expect(shell.getActiveKey()).toBe('sales')
    expect(onActiveChange).toHaveBeenLastCalledWith(
      'sales',
      expect.objectContaining({ key: 'sales' }),
    )
    expect(shell.breadcrumb().map((n) => n.key)).toEqual(['reports', 'sales'])
  })
})
