import { createStore, type Store } from './store'

/**
 * Framework-agnostic multi-tab navigation store — the engine behind a Vben-style
 * tab bar where each visited page is a closable tab and switching tabs preserves
 * component state via keep-alive. Pure logic + a subscribable store; the Vue /
 * React adapters bridge it and the host wires the actual keep-alive cache.
 *
 * Keep-alive contract: each tab has a monotonic refresh `version`; the host keys
 * its cached view by {@link TabsNav.cacheKey} (`key:version`) so {@link
 * TabsNav.refresh} forces a remount, and {@link TabsNav.cacheKeys} is the live
 * include-set of cached views.
 */

export interface TabItem {
  /** Stable unique key (route key / path). */
  key: string
  title: string
  icon?: string
  /** Whether the tab shows a close affordance. Default `true`. */
  closable?: boolean
  /** Pinned/affix tab: always kept, never closed by close-all / close-others. */
  pinned?: boolean
}

export interface TabsNavState {
  tabs: TabItem[]
  activeKey: string | undefined
  /** Per-tab refresh counter; bumping it remounts the kept-alive view. */
  versions: Record<string, number>
}

export interface TabsNavConfig {
  /** Initially open tabs (e.g. seeded affix tabs). */
  tabs?: TabItem[]
  /** Initially active key (defaults to the last seeded tab). */
  activeKey?: string
}

export interface TabsNav {
  store: Store<TabsNavState>
  getState(): TabsNavState
  subscribe(listener: (state: TabsNavState) => void): () => void
  /** Open `tab` (append if new) and activate it; an existing tab is re-activated and its title/icon refreshed. */
  open(tab: TabItem): void
  /** Activate an already-open tab by key (no-op when absent). */
  activate(key: string): void
  /** Close a tab; if it was active, activate the nearest neighbor (right, else left). Non-closable / pinned tabs are ignored. */
  close(key: string): void
  /** Close every closable tab except `key` (pinned stay); activates `key`. */
  closeOthers(key: string): void
  /** Close all closable tabs (pinned stay); activates the last remaining tab. */
  closeAll(): void
  /** Close closable tabs positioned before `key`. */
  closeLeft(key: string): void
  /** Close closable tabs positioned after `key`. */
  closeRight(key: string): void
  /** Bump `key`'s refresh version, remounting its kept-alive view. */
  refresh(key: string): void
  /** Pin / unpin a tab (pinned tabs are not closable). */
  setPinned(key: string, pinned: boolean): void
  /** Composite keep-alive key for `key` (`key:version`); changes on refresh. */
  cacheKey(key: string): string
  /** Keep-alive include-set: the composite cache keys of all open tabs. */
  cacheKeys(): string[]
}

/** A tab can be closed only when it is neither pinned nor explicitly `closable: false`. */
export function isClosable(tab: TabItem): boolean {
  return !tab.pinned && tab.closable !== false
}

export function createTabsNav(config: TabsNavConfig = {}): TabsNav {
  const initialTabs = (config.tabs ?? []).map((t) => ({ ...t, closable: t.closable ?? true }))
  const versions: Record<string, number> = {}
  for (const t of initialTabs) versions[t.key] = 0

  const store = createStore<TabsNavState>({
    tabs: initialTabs,
    activeKey: config.activeKey ?? initialTabs[initialTabs.length - 1]?.key,
    versions,
  })

  /** Pick the key to activate after `removed` (originally at `index`) leaves `tabs`. */
  const neighborKey = (tabs: TabItem[], index: number): string | undefined =>
    (tabs[index] ?? tabs[index - 1])?.key

  const open: TabsNav['open'] = (tab) => {
    store.setState((s) => {
      const existing = s.tabs.find((t) => t.key === tab.key)
      if (existing) {
        return {
          ...s,
          activeKey: tab.key,
          tabs: s.tabs.map((t) => (t.key === tab.key ? { ...t, ...tab } : t)),
        }
      }
      const item: TabItem = { ...tab, closable: tab.closable ?? true }
      return {
        ...s,
        tabs: [...s.tabs, item],
        activeKey: tab.key,
        versions: { ...s.versions, [tab.key]: 0 },
      }
    })
  }

  const activate: TabsNav['activate'] = (key) => {
    store.setState((s) => (s.tabs.some((t) => t.key === key) ? { ...s, activeKey: key } : s))
  }

  const close: TabsNav['close'] = (key) => {
    store.setState((s) => {
      const index = s.tabs.findIndex((t) => t.key === key)
      if (index < 0 || !isClosable(s.tabs[index]!)) return s
      const tabs = s.tabs.filter((t) => t.key !== key)
      const activeKey = s.activeKey === key ? neighborKey(tabs, index) : s.activeKey
      const nextVersions = { ...s.versions }
      delete nextVersions[key]
      return { ...s, tabs, activeKey, versions: nextVersions }
    })
  }

  const pruneTo = (
    s: TabsNavState,
    keep: (tab: TabItem, index: number) => boolean,
    nextActive: (tabs: TabItem[]) => string | undefined,
  ): TabsNavState => {
    const tabs = s.tabs.filter((t, i) => keep(t, i) || !isClosable(t))
    const versions: Record<string, number> = {}
    for (const t of tabs) versions[t.key] = s.versions[t.key] ?? 0
    return { ...s, tabs, versions, activeKey: nextActive(tabs) }
  }

  const closeOthers: TabsNav['closeOthers'] = (key) => {
    store.setState((s) =>
      s.tabs.some((t) => t.key === key)
        ? pruneTo(
            s,
            (t) => t.key === key,
            () => key,
          )
        : s,
    )
  }

  const closeAll: TabsNav['closeAll'] = () => {
    store.setState((s) =>
      pruneTo(
        s,
        () => false,
        (tabs) =>
          tabs.some((t) => t.key === s.activeKey) ? s.activeKey : tabs[tabs.length - 1]?.key,
      ),
    )
  }

  const closeLeft: TabsNav['closeLeft'] = (key) => {
    store.setState((s) => {
      const pivot = s.tabs.findIndex((t) => t.key === key)
      if (pivot < 0) return s
      return pruneTo(
        s,
        (_t, i) => i >= pivot,
        (tabs) => (tabs.some((t) => t.key === s.activeKey) ? s.activeKey : key),
      )
    })
  }

  const closeRight: TabsNav['closeRight'] = (key) => {
    store.setState((s) => {
      const pivot = s.tabs.findIndex((t) => t.key === key)
      if (pivot < 0) return s
      return pruneTo(
        s,
        (_t, i) => i <= pivot,
        (tabs) => (tabs.some((t) => t.key === s.activeKey) ? s.activeKey : key),
      )
    })
  }

  const refresh: TabsNav['refresh'] = (key) => {
    store.setState((s) =>
      s.tabs.some((t) => t.key === key)
        ? { ...s, versions: { ...s.versions, [key]: (s.versions[key] ?? 0) + 1 } }
        : s,
    )
  }

  const setPinned: TabsNav['setPinned'] = (key, pinned) => {
    store.setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.key === key ? { ...t, pinned } : t)),
    }))
  }

  const cacheKey: TabsNav['cacheKey'] = (key) => `${key}:${store.getState().versions[key] ?? 0}`
  const cacheKeys: TabsNav['cacheKeys'] = () => store.getState().tabs.map((t) => cacheKey(t.key))

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    open,
    activate,
    close,
    closeOthers,
    closeAll,
    closeLeft,
    closeRight,
    refresh,
    setPinned,
    cacheKey,
    cacheKeys,
  }
}
