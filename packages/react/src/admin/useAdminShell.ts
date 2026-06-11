import * as React from 'react'
import {
  createAdminShell,
  findNavPath,
  type AdminShell,
  type NavNode,
  type TabsNav,
} from '@iris-ui/core'
import { useStore } from '../useStore'

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
  activeKey: string
  /** Select a nav node: a branch redirects to its first leaf, opens its tab. */
  navigate: (node: NavNode) => void
  /** Reconcile when the active TAB changed (e.g. a close picked a neighbor). */
  syncFromTab: (key: string) => void
  /** Ancestor→node breadcrumb trail of the active key. */
  breadcrumb: NavNode[]
}

/**
 * React binding for the framework-agnostic {@link createAdminShell} controller —
 * the menu→tab→active-key wiring that every AdminLayout used to re-implement
 * byte-for-byte. The hook owns the controlled/uncontrolled `activeKey`
 * reconciliation (idiomatic to React) and delegates navigate / syncFromTab /
 * branch-resolution / breadcrumb to the shared core shell.
 *
 * Controlled mode renders from the prop directly (no flicker); an effect keeps
 * the shell's guard-base synced to the prop so the active-change callback fires
 * with the same semantics as before.
 */
export function useAdminShell(config: UseAdminShellConfig): UseAdminShellReturn {
  const { menus, activeKey, defaultActiveKey, onActiveKeyChange, onSelect, tabs } = config
  const activeControlled = activeKey !== undefined

  // Latest callbacks read without re-creating the (stable) shell instance.
  const latest = React.useRef({ onActiveKeyChange, onSelect })
  latest.current = { onActiveKeyChange, onSelect }

  const shellRef = React.useRef<AdminShell | null>(null)
  if (shellRef.current === null) {
    shellRef.current = createAdminShell({
      menus,
      defaultActiveKey: activeKey ?? defaultActiveKey,
      tabs,
      onActiveChange: (key, node) => {
        latest.current.onActiveKeyChange?.(key)
        if (node) latest.current.onSelect?.(key, node)
      },
    })
  }
  const shell = shellRef.current
  const state = useStore(shell.store)

  // Keep the shell reconciling against the live menu tree.
  React.useEffect(() => {
    shell.setMenus(menus)
  }, [shell, menus])

  // Controlled: keep the shell's guard-base aligned with the prop (silent — no
  // callback), so navigate fires the active-change callback exactly as before
  // even when a controlled parent does not write the new key back.
  React.useEffect(() => {
    if (activeControlled && shell.getActiveKey() !== (activeKey ?? null)) {
      shell.store.setState({ activeKey: activeKey ?? null })
    }
  })

  const current = activeControlled ? (activeKey ?? '') : (state.activeKey ?? '')

  return {
    activeKey: current,
    navigate: shell.navigate,
    syncFromTab: shell.syncFromTab,
    breadcrumb: current ? findNavPath(menus, current) : [],
  }
}
