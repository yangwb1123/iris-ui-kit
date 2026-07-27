import { useStore } from '../useStore'
import type { TabsNav, TabItem } from '@iris-ui-kit/core'

export interface UseTabsNavReturn {
  tabs: TabItem[]
  activeKey: string | undefined
  /** Keep-alive include-set (composite cache keys of all open tabs). */
  cacheKeys: string[]
  open: TabsNav['open']
  activate: TabsNav['activate']
  close: TabsNav['close']
  closeOthers: TabsNav['closeOthers']
  closeAll: TabsNav['closeAll']
  closeLeft: TabsNav['closeLeft']
  closeRight: TabsNav['closeRight']
  refresh: TabsNav['refresh']
  setPinned: TabsNav['setPinned']
  move: TabsNav['move']
  cacheKey: TabsNav['cacheKey']
}

/**
 * React binding for a framework-agnostic {@link TabsNav} store. Pass a shared
 * `createTabsNav()` instance (the host owns it so the tab bar and the keep-alive
 * content read the same state) and get the reactive `tabs` / `activeKey` /
 * `cacheKeys` plus the store's mutators — bridged via `useStore`
 * (`useSyncExternalStore`), mirroring the Vue adapter.
 *
 * ```tsx
 * const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
 * const { tabs, activeKey, open, close } = useTabsNav(nav)
 * ```
 */
export function useTabsNav(nav: TabsNav): UseTabsNavReturn {
  const state = useStore(nav.store)
  return {
    tabs: state.tabs,
    activeKey: state.activeKey,
    cacheKeys: state.tabs.map((t) => nav.cacheKey(t.key)),
    open: nav.open,
    activate: nav.activate,
    close: nav.close,
    closeOthers: nav.closeOthers,
    closeAll: nav.closeAll,
    closeLeft: nav.closeLeft,
    closeRight: nav.closeRight,
    refresh: nav.refresh,
    setPinned: nav.setPinned,
    move: nav.move,
    cacheKey: nav.cacheKey,
  }
}
