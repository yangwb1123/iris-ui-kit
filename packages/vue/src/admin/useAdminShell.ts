import { computed, watch, watchEffect, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue'
import {
  createAdminShell,
  findNavPath,
  type AdminShell,
  type NavNode,
  type TabsNav,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseAdminShellConfig {
  /** Normalized nav tree driving menu + breadcrumb. */
  menus: MaybeRefOrGetter<NavNode[]>
  /** Active page key (controlled); undefined = uncontrolled. */
  activeKey?: MaybeRefOrGetter<string | undefined>
  defaultActiveKey?: string
  onActiveKeyChange?: (key: string) => void
  /** Fired whenever a nav node / tab becomes active, with the resolved leaf node. */
  onSelect?: (key: string, node: NavNode) => void
  /** Optional shared tabs store; the shell opens/reconciles tabs through it. */
  tabs?: TabsNav
}

export interface UseAdminShellReturn {
  /** Current active leaf key ('' when none). */
  activeKey: ComputedRef<string>
  /** Select a nav node: a branch redirects to its first leaf, opens its tab. */
  navigate: (node: NavNode) => void
  /** Reconcile when the active TAB changed (e.g. a close picked a neighbor). */
  syncFromTab: (key: string) => void
  /** Ancestor→node breadcrumb trail of the active key. */
  breadcrumb: ComputedRef<NavNode[]>
}

/**
 * Vue binding for the framework-agnostic {@link createAdminShell} controller —
 * the menu→tab→active-key wiring that every AdminLayout used to re-implement
 * byte-for-byte. The composable owns the controlled/uncontrolled `activeKey`
 * reconciliation (idiomatic to Vue) and delegates navigate / syncFromTab /
 * branch-resolution / breadcrumb to the shared core shell.
 *
 * Controlled mode renders from the prop directly (no flicker); a watcher keeps
 * the shell's guard-base synced to the prop so the active-change callback fires
 * with the same semantics as before.
 */
export function useAdminShell(config: UseAdminShellConfig): UseAdminShellReturn {
  const { defaultActiveKey, onActiveKeyChange, onSelect, tabs } = config

  const menus = (): NavNode[] => toValue(config.menus)
  const activeKeyProp = (): string | undefined => toValue(config.activeKey)
  const activeControlled = (): boolean => activeKeyProp() !== undefined

  // The shell instance is stable for the composable's lifetime; it reads the
  // latest callbacks via the closure-captured config.
  const shell: AdminShell = createAdminShell({
    menus: menus(),
    defaultActiveKey: activeKeyProp() ?? defaultActiveKey,
    tabs,
    onActiveChange: (key, node) => {
      onActiveKeyChange?.(key)
      if (node) onSelect?.(key, node)
    },
  })
  const state = useStore(shell.store)

  // Keep the shell reconciling against the live menu tree.
  watch(menus, (next) => shell.setMenus(next), { flush: 'sync' })

  // Controlled: keep the shell's guard-base aligned with the prop (silent — no
  // callback), so navigate fires the active-change callback exactly as before
  // even when a controlled parent does not write the new key back.
  watchEffect(() => {
    const prop = activeKeyProp()
    if (prop !== undefined && shell.getActiveKey() !== prop) {
      shell.store.setState({ activeKey: prop })
    }
  })

  const activeKey = computed(() =>
    activeControlled() ? (activeKeyProp() ?? '') : (state.value.activeKey ?? ''),
  )

  return {
    activeKey,
    navigate: shell.navigate,
    syncFromTab: shell.syncFromTab,
    breadcrumb: computed(() => (activeKey.value ? findNavPath(menus(), activeKey.value) : [])),
  }
}
