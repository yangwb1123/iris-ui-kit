import { derived, type Readable } from 'svelte/store'
import type { TabsNav, TabItem } from '@iris-ui-kit/core'
import { toStore } from '../useStore'

export interface UseTabsNavReturn {
  tabs: Readable<TabItem[]>
  activeKey: Readable<string | undefined>
  /** Keep-alive include-set (composite cache keys of all open tabs). */
  cacheKeys: Readable<string[]>
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
 * Svelte binding for a framework-agnostic {@link TabsNav} store. Pass a shared
 * `createTabsNav()` instance and get reactive `tabs` / `activeKey` / `cacheKeys`
 * Svelte stores (use `$tabs` etc.) plus the store's mutators — bridged via
 * `toStore`, mirroring the React/Vue/Solid adapters. Plain stores (no runes), so
 * callable anywhere.
 */
export function useTabsNav(nav: TabsNav): UseTabsNavReturn {
  const state = toStore(nav.store)
  return {
    tabs: derived(state, (s) => s.tabs),
    activeKey: derived(state, (s) => s.activeKey),
    cacheKeys: derived(state, (s) => s.tabs.map((t) => nav.cacheKey(t.key))),
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
