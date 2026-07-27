import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createTabsNav, type NavNode } from '@iris-ui-kit/core'
import { useAdminShell, type UseAdminShellConfig } from './useAdminShell'

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

/** Mount a probe that exposes the bridge's API + reactive activeKey in the DOM. */
function probe(
  config: Omit<UseAdminShellConfig, 'menus' | 'activeKey'> & { activeKey?: Ref<string> },
) {
  const api: { value?: ReturnType<typeof useAdminShell> } = {}
  const Comp = defineComponent({
    setup() {
      const shell = useAdminShell({
        menus: () => menus,
        activeKey: config.activeKey ? () => config.activeKey!.value : undefined,
        defaultActiveKey: config.defaultActiveKey,
        onActiveKeyChange: config.onActiveKeyChange,
        onSelect: config.onSelect,
        tabs: config.tabs,
      })
      api.value = shell
      return () =>
        h('div', [
          h('span', { 'data-active': '' }, shell.activeKey.value),
          h('span', { 'data-crumbs': '' }, shell.breadcrumb.value.map((n) => n.key).join(',')),
        ])
    },
  })
  const w = mount(Comp)
  return { w, api: api.value! }
}

describe('useAdminShell (vue)', () => {
  it('uncontrolled: navigate on a leaf updates active key + fires callbacks', async () => {
    const onActiveKeyChange = vi.fn()
    const onSelect = vi.fn()
    const { w, api } = probe({ defaultActiveKey: 'dash', onActiveKeyChange, onSelect })
    expect(api.activeKey.value).toBe('dash')
    api.navigate({ key: 'roles', title: 'Roles' })
    await w.vm.$nextTick()
    expect(api.activeKey.value).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
    expect(onSelect.mock.calls.at(-1)).toEqual(['roles', expect.objectContaining({ key: 'roles' })])
  })

  it('navigate on a branch redirects to its first leaf', async () => {
    const { w, api } = probe({ defaultActiveKey: 'dash' })
    api.navigate(menus[1]) // System (branch)
    await w.vm.$nextTick()
    expect(api.activeKey.value).toBe('users')
  })

  it('controlled: active key follows the prop, navigate still fires onActiveKeyChange', async () => {
    const onActiveKeyChange = vi.fn()
    const activeKey = ref('dash')
    const { w, api } = probe({ activeKey, onActiveKeyChange })
    expect(api.activeKey.value).toBe('dash')
    api.navigate({ key: 'users', title: 'Users' })
    await w.vm.$nextTick()
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('users')
    // Controlled: render still reflects the prop until the parent writes it back.
    expect(api.activeKey.value).toBe('dash')
    activeKey.value = 'users'
    await w.vm.$nextTick()
    expect(api.activeKey.value).toBe('users')
  })

  it('navigate opens a tab in the shared store', async () => {
    const tabs = createTabsNav({ tabs: [{ key: 'dash', title: 'Dashboard', pinned: true }] })
    const { w, api } = probe({ defaultActiveKey: 'dash', tabs })
    api.navigate({ key: 'users', title: 'Users' })
    await w.vm.$nextTick()
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['dash', 'users'])
    expect(tabs.getState().activeKey).toBe('users')
  })

  it('syncFromTab reconciles the active key (e.g. a tab close picked a neighbor)', async () => {
    const onActiveKeyChange = vi.fn()
    const { w, api } = probe({ defaultActiveKey: 'dash', onActiveKeyChange })
    api.syncFromTab('roles')
    await w.vm.$nextTick()
    expect(api.activeKey.value).toBe('roles')
    expect(onActiveKeyChange).toHaveBeenLastCalledWith('roles')
  })

  it('breadcrumb returns the ancestor trail of the active key', async () => {
    const { w, api } = probe({ defaultActiveKey: 'dash' })
    api.navigate({ key: 'users', title: 'Users' })
    await w.vm.$nextTick()
    expect(api.breadcrumb.value.map((n) => n.key)).toEqual(['sys', 'users'])
  })
})
