import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createTabsNav, type NavNode } from '@iris-ui/core'
import { useAdminShell } from './useAdminShell'

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

describe('useAdminShell (react)', () => {
  it('uncontrolled: navigate on a leaf updates active key + fires callbacks', () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useAdminShell({ menus, defaultActiveKey: 'dash', onActiveKeyChange, onSelect }),
    )
    expect(result.current.activeKey).toBe('dash')
    act(() => result.current.navigate({ key: 'roles', title: 'Roles' }))
    expect(result.current.activeKey).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
    expect(onSelect.mock.calls.at(-1)).toEqual(['roles', expect.objectContaining({ key: 'roles' })])
  })

  it('navigate on a branch redirects to its first leaf', () => {
    const { result } = renderHook(() => useAdminShell({ menus, defaultActiveKey: 'dash' }))
    act(() => result.current.navigate(menus[1])) // System (branch)
    expect(result.current.activeKey).toBe('users')
  })

  it('controlled: active key follows the prop, navigate still fires onActiveKeyChange', () => {
    const onActiveKeyChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ activeKey }: { activeKey: string }) =>
        useAdminShell({ menus, activeKey, onActiveKeyChange }),
      { initialProps: { activeKey: 'dash' } },
    )
    expect(result.current.activeKey).toBe('dash')
    act(() => result.current.navigate({ key: 'users', title: 'Users' }))
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    // Controlled: render still reflects the prop until the parent writes it back.
    expect(result.current.activeKey).toBe('dash')
    rerender({ activeKey: 'users' })
    expect(result.current.activeKey).toBe('users')
  })

  it('navigate opens a tab in the shared store', () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const { result } = renderHook(() => useAdminShell({ menus, defaultActiveKey: 'dash', tabs }))
    act(() => result.current.navigate({ key: 'users', title: 'Users' }))
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(tabs.getState().activeKey).toBe('users')
  })

  it('syncFromTab reconciles the active key (e.g. a tab close picked a neighbor)', () => {
    const onActiveKeyChange = vi.fn()
    const { result } = renderHook(() =>
      useAdminShell({ menus, defaultActiveKey: 'dash', onActiveKeyChange }),
    )
    act(() => result.current.syncFromTab('roles'))
    expect(result.current.activeKey).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
  })

  it('breadcrumb returns the ancestor trail of the active key', () => {
    const { result } = renderHook(() => useAdminShell({ menus, defaultActiveKey: 'dash' }))
    act(() => result.current.navigate({ key: 'users', title: 'Users' }))
    expect(result.current.breadcrumb.map((n) => n.key)).toEqual(['sys', 'users'])
  })
})
