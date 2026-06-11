import {
  createAdminShell,
  findNavPath,
  type AdminShell,
  type NavNode,
  type TabsNav,
} from '@iris-ui/core'

export interface UseAdminShellConfig {
  /** Normalized nav tree driving menu + breadcrumb. */
  menus: NavNode[]
  /** Active page key (controlled); undefined = uncontrolled. */
  activeKey?: string
  defaultActiveKey?: string
  onActiveKeyChange?: (key: string) => void
  /** Fired whenever a nav node / tab becomes active, with the resolved leaf node. */
  onSelect?: (key: string, node: NavNode) => void
  /** Optional shared tabs store; the shell opens/reconciles tabs through it. */
  tabs?: TabsNav
}

export interface UseAdminShellReturn {
  /** Current active leaf key ('' when none). */
  readonly activeKey: string
  /** Select a nav node: a branch redirects to its first leaf, opens its tab. */
  navigate: (node: NavNode) => void
  /** Reconcile when the active TAB changed (e.g. a close picked a neighbor). */
  syncFromTab: (key: string) => void
  /** Ancestor→node breadcrumb trail of the active key. */
  readonly breadcrumb: NavNode[]
}

/**
 * Svelte binding for the framework-agnostic {@link createAdminShell} controller —
 * the menu→tab→active-key wiring that every AdminLayout used to re-implement
 * byte-for-byte. The hook owns the controlled/uncontrolled `activeKey`
 * reconciliation (idiomatic to Svelte 5 runes) and delegates navigate /
 * syncFromTab / branch-resolution / breadcrumb to the shared core shell.
 *
 * Controlled mode renders from the prop directly (no flicker); an effect keeps
 * the shell's guard-base synced to the prop so the active-change callback fires
 * with the same semantics as before. Call from a component (runes need a
 * reactive owner); pass the config via a getter so the live `menus` / `activeKey`
 * props stay reactive.
 */
export function useAdminShell(config: () => UseAdminShellConfig): UseAdminShellReturn {
  const cfg = $derived(config())
  const activeControlled = $derived(cfg.activeKey !== undefined)

  // Stable shell instance, seeded once from the initial config.
  // svelte-ignore state_referenced_locally — one-time seed; reactive reads below.
  const init = config()
  const shell: AdminShell = createAdminShell({
    menus: init.menus,
    defaultActiveKey: init.activeKey ?? init.defaultActiveKey,
    tabs: init.tabs,
    onActiveChange: (key, node) => {
      cfg.onActiveKeyChange?.(key)
      if (node) cfg.onSelect?.(key, node)
    },
  })

  // Bridge the shell store into a rune so render/breadcrumb track activeKey.
  let storeActive = $state<string | null>(shell.getActiveKey())
  $effect(() => {
    return shell.store.subscribe((s) => {
      storeActive = s.activeKey
    })
  })

  // Keep the shell reconciling against the live menu tree.
  $effect(() => {
    shell.setMenus(cfg.menus)
  })

  // Controlled: keep the shell's guard-base aligned with the prop (silent — no
  // callback), so navigate fires the active-change callback exactly as before
  // even when a controlled parent does not write the new key back.
  $effect(() => {
    const key = cfg.activeKey
    if (activeControlled && shell.getActiveKey() !== (key ?? null)) {
      shell.store.setState({ activeKey: key ?? null })
    }
  })

  const current = $derived(activeControlled ? (cfg.activeKey ?? '') : (storeActive ?? ''))
  const trail = $derived(current ? findNavPath(cfg.menus, current) : [])

  return {
    get activeKey() {
      return current
    },
    navigate: shell.navigate,
    syncFromTab: shell.syncFromTab,
    get breadcrumb() {
      return trail
    },
  }
}
