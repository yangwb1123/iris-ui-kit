import { createStore, type Store } from './store'
import { createTabsNav, type TabsNav } from './tabsNav'
import { findNavNode, findNavPath, firstLeaf, isBranch, type NavNode } from './nav'

/**
 * Framework-agnostic admin-shell controller (L4 composite) — ties the nav tree
 * to the multi-tab store, the menu→tab wiring that is the heart of a Vben-style
 * shell. Today this `navigate` + `syncFromTab` logic is re-implemented
 * byte-for-byte in every adapter's AdminLayout; here it lives once.
 *
 * The adapter calls {@link AdminShell.navigate} on menu select, subscribes to
 * `shell.tabs.store` and calls {@link AdminShell.syncFromTab} on change, and
 * renders the active page from `shell.store` (activeKey) + `shell.breadcrumb()`.
 */
export interface AdminShellConfig {
  menus: NavNode[]
  /** Initial active leaf key. */
  defaultActiveKey?: string
  /** Notified whenever the active key changes (programmatically or via tabs). */
  onActiveChange?: (key: string, node: NavNode | undefined) => void
  /** Reuse an existing tabs store; otherwise one is created. */
  tabs?: TabsNav
}

export interface AdminShellState {
  activeKey: string | null
}

export interface AdminShell {
  store: Store<AdminShellState>
  tabs: TabsNav
  getActiveKey(): string | null
  /**
   * Handle a nav-node selection: a branch redirects to its `firstLeaf`; the
   * leaf becomes active and opens (or re-activates) a tab.
   */
  navigate(node: NavNode): void
  /**
   * Reconcile when the active TAB changed (e.g. a close picked a neighbor).
   * Guarded against the navigate→open→activeKey feedback loop.
   */
  syncFromTab(key: string | null | undefined): void
  /** Ancestor→node breadcrumb trail for the active key. */
  breadcrumb(): NavNode[]
  /**
   * Replace the nav tree the shell reconciles against (e.g. an adapter whose
   * `menus` prop changed). `navigate` already resolves from the passed node, so
   * this only affects `syncFromTab` node lookup + `breadcrumb`.
   */
  setMenus(menus: NavNode[]): void
}

export function createAdminShell(config: AdminShellConfig): AdminShell {
  const tabs = config.tabs ?? createTabsNav()
  const store = createStore<AdminShellState>({ activeKey: config.defaultActiveKey ?? null })
  let menus = config.menus

  const setActive = (key: string): void => {
    if (store.getState().activeKey === key) return
    store.setState({ activeKey: key })
    config.onActiveChange?.(key, findNavNode(menus, key))
  }

  return {
    store,
    tabs,
    getActiveKey: () => store.getState().activeKey,

    navigate(node) {
      const leaf = isBranch(node) ? firstLeaf(node) : node
      setActive(leaf.key)
      tabs.open({ key: leaf.key, title: leaf.title, icon: leaf.icon })
    },

    syncFromTab(key) {
      if (!key || key === store.getState().activeKey) return
      setActive(key)
    },

    breadcrumb() {
      const key = store.getState().activeKey
      return key ? findNavPath(menus, key) : []
    },

    setMenus(next) {
      menus = next
    },
  }
}
