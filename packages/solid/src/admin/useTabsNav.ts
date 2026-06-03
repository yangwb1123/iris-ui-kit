import { type Accessor } from 'solid-js'
import type { TabsNav, TabItem } from '@iris-ui/core'
import { useStore } from '../useStore'

export interface UseTabsNavReturn {
  tabs: Accessor<TabItem[]>
  activeKey: Accessor<string | undefined>
  /** Keep-alive include-set (composite cache keys of all open tabs). */
  cacheKeys: Accessor<string[]>
  open: TabsNav['open']
  activate: TabsNav['activate']
  close: TabsNav['close']
  closeOthers: TabsNav['closeOthers']
  closeAll: TabsNav['closeAll']
  closeLeft: TabsNav['closeLeft']
  closeRight: TabsNav['closeRight']
  refresh: TabsNav['refresh']
  setPinned: TabsNav['setPinned']
  cacheKey: TabsNav['cacheKey']
}

/**
 * Solid binding for a framework-agnostic {@link TabsNav} store. Pass a shared
 * `createTabsNav()` instance and get reactive `tabs` / `activeKey` / `cacheKeys`
 * accessors plus the store's mutators — bridged via `useStore`, mirroring the
 * React/Vue adapters.
 */
export function useTabsNav(nav: TabsNav): UseTabsNavReturn {
  const state = useStore(nav.store)
  return {
    tabs: () => state().tabs,
    activeKey: () => state().activeKey,
    cacheKeys: () => state().tabs.map((t) => nav.cacheKey(t.key)),
    open: nav.open,
    activate: nav.activate,
    close: nav.close,
    closeOthers: nav.closeOthers,
    closeAll: nav.closeAll,
    closeLeft: nav.closeLeft,
    closeRight: nav.closeRight,
    refresh: nav.refresh,
    setPinned: nav.setPinned,
    cacheKey: nav.cacheKey,
  }
}
