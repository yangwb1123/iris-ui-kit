import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import type { TabsNav, TabsNavState, TabItem } from '@iris-ui-kit/core'

export interface UseTabsNavReturn {
  tabs: ComputedRef<TabItem[]>
  activeKey: ComputedRef<string | undefined>
  /** Keep-alive include-set (composite cache keys of all open tabs). */
  cacheKeys: ComputedRef<string[]>
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
 * Vue binding for a framework-agnostic {@link TabsNav} store. Pass a shared
 * `createTabsNav()` instance (the host owns it so the tab bar and the keep-alive
 * content can read the same state) and get reactive `tabs` / `activeKey` /
 * `cacheKeys` plus the store's mutators.
 *
 * ```ts
 * const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
 * const { tabs, activeKey, open, close } = useTabsNav(nav)
 * ```
 */
export function useTabsNav(nav: TabsNav): UseTabsNavReturn {
  const state = ref(nav.getState()) as Ref<TabsNavState>
  const unsubscribe = nav.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  return {
    tabs: computed(() => state.value.tabs),
    activeKey: computed(() => state.value.activeKey),
    cacheKeys: computed(() => state.value.tabs.map((t) => nav.cacheKey(t.key))),
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
