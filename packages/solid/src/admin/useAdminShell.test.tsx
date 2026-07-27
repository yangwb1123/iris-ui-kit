import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, cleanup } from '@solidjs/testing-library'
import { createTabsNav, type NavNode } from '@iris-ui-kit/core'
import { useAdminShell, type UseAdminShellConfig, type UseAdminShellReturn } from './useAdminShell'

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

/** Mount the hook in a reactive root and capture its accessor-based API. */
function probe(
  config: Omit<UseAdminShellConfig, 'menus' | 'activeKey'> & {
    menus?: NavNode[]
    activeKey?: () => string | undefined
  },
): { api: UseAdminShellReturn } {
  let api!: UseAdminShellReturn
  const Probe = () => {
    api = useAdminShell({
      menus: () => config.menus ?? menus,
      activeKey: config.activeKey ?? (() => undefined),
      defaultActiveKey: config.defaultActiveKey,
      onActiveKeyChange: config.onActiveKeyChange,
      onSelect: config.onSelect,
      tabs: config.tabs,
    })
    return null
  }
  render(() => <Probe />)
  return { api }
}

describe('useAdminShell (solid)', () => {
  it('uncontrolled: navigate on a leaf updates active key + fires callbacks', () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    const { api } = probe({ defaultActiveKey: 'dash', onActiveKeyChange, onSelect })
    expect(api.activeKey()).toBe('dash')
    api.navigate({ key: 'roles', title: 'Roles' })
    expect(api.activeKey()).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
    expect(onSelect.mock.calls.at(-1)).toEqual(['roles', expect.objectContaining({ key: 'roles' })])
  })

  it('navigate on a branch redirects to its first leaf', () => {
    const { api } = probe({ defaultActiveKey: 'dash' })
    api.navigate(menus[1]) // System (branch)
    expect(api.activeKey()).toBe('users')
  })

  it('controlled: active key follows the prop, navigate still fires onActiveKeyChange', () => {
    const onActiveKeyChange = vi.fn()
    const [activeKey, setActiveKey] = createSignal<string | undefined>('dash')
    const { api } = probe({ activeKey, onActiveKeyChange })
    expect(api.activeKey()).toBe('dash')
    api.navigate({ key: 'users', title: 'Users' })
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    // Controlled: render still reflects the prop until the parent writes it back.
    expect(api.activeKey()).toBe('dash')
    setActiveKey('users')
    expect(api.activeKey()).toBe('users')
  })

  it('navigate opens a tab in the shared store', () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const { api } = probe({ defaultActiveKey: 'dash', tabs })
    api.navigate({ key: 'users', title: 'Users' })
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(tabs.getState().activeKey).toBe('users')
  })

  it('syncFromTab reconciles the active key (e.g. a tab close picked a neighbor)', () => {
    const onActiveKeyChange = vi.fn()
    const { api } = probe({ defaultActiveKey: 'dash', onActiveKeyChange })
    api.syncFromTab('roles')
    expect(api.activeKey()).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
  })

  it('breadcrumb returns the ancestor trail of the active key', () => {
    const { api } = probe({ defaultActiveKey: 'dash' })
    api.navigate({ key: 'users', title: 'Users' })
    expect(api.breadcrumb().map((n) => n.key)).toEqual(['sys', 'users'])
  })
})
