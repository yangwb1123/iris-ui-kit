import { createEffect, type Accessor } from 'solid-js'
import {
  createAdminShell,
  findNavPath,
  type AdminShell,
  type NavNode,
  type TabsNav,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseAdminShellConfig {
  /** Normalized nav tree driving menu + breadcrumb (live accessor — stays reactive). */
  menus: Accessor<NavNode[]>
  /** Active page key (controlled); accessor returning `undefined` = uncontrolled. */
  activeKey: Accessor<string | undefined>
  defaultActiveKey?: string
  onActiveKeyChange?: (key: string) => void
  /** Fired whenever a nav node / tab becomes active, with the resolved leaf node. */
  onSelect?: (key: string, node: NavNode) => void
  /** Optional shared tabs store; the shell opens/reconciles tabs through it. */
  tabs?: TabsNav
}

export interface UseAdminShellReturn {
  /** Current active leaf key ('' when none). */
  activeKey: Accessor<string>
  /** Select a nav node: a branch redirects to its first leaf, opens its tab. */
  navigate: (node: NavNode) => void
  /** Reconcile when the active TAB changed (e.g. a close picked a neighbor). */
  syncFromTab: (key: string) => void
  /** Ancestor→node breadcrumb trail of the active key. */
  breadcrumb: Accessor<NavNode[]>
}

/**
 * Solid binding for the framework-agnostic {@link createAdminShell} controller —
 * the menu→tab→active-key wiring that every AdminLayout used to re-implement
 * byte-for-byte. The hook owns the controlled/uncontrolled `activeKey`
 * reconciliation (idiomatic to Solid) and delegates navigate / syncFromTab /
 * branch-resolution / breadcrumb to the shared core shell.
 *
 * Controlled mode renders from the prop directly (no flicker); a `createEffect`
 * keeps the shell's guard-base synced to the prop SILENTLY (writing the store
 * state directly — never via the active-change path) so the active-change
 * callback still fires with the same semantics even when a controlled parent
 * does not write the new key back.
 */
export function useAdminShell(config: UseAdminShellConfig): UseAdminShellReturn {
  const activeControlled = (): boolean => config.activeKey() !== undefined

  const shell: AdminShell = createAdminShell({
    menus: config.menus(),
    defaultActiveKey: config.activeKey() ?? config.defaultActiveKey,
    tabs: config.tabs,
    onActiveChange: (key, node) => {
      config.onActiveKeyChange?.(key)
      if (node) config.onSelect?.(key, node)
    },
  })
  const state = useStore(shell.store)

  // Keep the shell reconciling against the live menu tree.
  createEffect(() => {
    shell.setMenus(config.menus())
  })

  // Controlled: keep the shell's guard-base aligned with the prop (silent — no
  // callback), so navigate fires the active-change callback exactly as before
  // even when a controlled parent does not write the new key back.
  createEffect(() => {
    const next = config.activeKey()
    if (next !== undefined && shell.getActiveKey() !== next) {
      shell.store.setState({ activeKey: next })
    }
  })

  const current = (): string =>
    activeControlled() ? (config.activeKey() ?? '') : (state().activeKey ?? '')

  return {
    activeKey: current,
    navigate: shell.navigate,
    syncFromTab: shell.syncFromTab,
    breadcrumb: () => {
      const key = current()
      return key ? findNavPath(config.menus(), key) : []
    },
  }
}
