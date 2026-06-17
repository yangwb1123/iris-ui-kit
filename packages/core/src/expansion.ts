import { createStore, type Store } from './store'
import { normalizeKeys } from './utils'

/**
 * Framework-agnostic expansion model — the open/closed set of keys behind
 * Accordion, the admin NavMenu, Tree, and Collapse (each currently re-derives
 * it per framework). `single` mode is accordion semantics (≤ 1 open); `multiple`
 * is tree/menu semantics. {@link ExpansionModel.merge} unions in a set without
 * dropping current open keys — used to auto-open the active trail
 * (`branchTrail`) on navigation.
 *
 * Uncontrolled-internal + `onChange`, mirroring {@link createSelectionModel};
 * a controlled adapter calls {@link ExpansionModel.set} from an effect.
 */
export type ExpansionMode = 'single' | 'multiple'

export interface ExpansionConfig<K extends string | number = string> {
  mode?: ExpansionMode
  defaultExpanded?: K[]
  onChange?: (keys: K[]) => void
}

export interface ExpansionModel<K extends string | number = string> {
  store: Store<K[]>
  get(): K[]
  isExpanded(key: K): boolean
  toggle(key: K): void
  expand(key: K): void
  collapse(key: K): void
  set(keys: K[]): void
  /** Union `keys` into the current set (no removals). No-op if all present. */
  merge(keys: K[]): void
  /** Expand every key in `keys`. In single mode, expands only the last key. */
  expandAll(keys: K[]): void
  /** Collapse all expanded keys. */
  collapseAll(): void
}

export function createExpansion<K extends string | number = string>(
  config: ExpansionConfig<K> = {},
): ExpansionModel<K> {
  const mode: ExpansionMode = config.mode ?? 'multiple'
  const initial = normalizeKeys(config.defaultExpanded ?? [], mode)
  const store = createStore<K[]>(initial)

  // Set index for O(1) lookups and O(1) deletions (vs filter O(n))
  let index = new Set<K>(initial)

  function syncIndex(keys: K[]): void {
    index = new Set<K>(keys)
  }
  store.subscribe(syncIndex)

  function commit(next: K[]): void {
    const value = normalizeKeys(next, mode)
    store.setState(value)
    syncIndex(value)
    config.onChange?.(value)
  }

  function has(key: K): boolean {
    return index.has(key)
  }

  return {
    store,
    get: store.getState,
    isExpanded: has,
    toggle(key) {
      if (has(key)) {
        // O(1) collapse via Set — avoids filter O(n) on the array
        const next = new Set(index)
        next.delete(key)
        commit(Array.from(next))
      } else {
        commit(mode === 'single' ? [key] : [...store.getState(), key])
      }
    },
    expand(key) {
      if (has(key)) return
      commit(mode === 'single' ? [key] : [...store.getState(), key])
    },
    collapse(key) {
      if (!has(key)) return
      // O(1) via Set
      const next = new Set(index)
      next.delete(key)
      commit(Array.from(next))
    },
    set(keys) {
      commit(keys)
    },
    merge(keys) {
      if (keys.every((k) => has(k))) return
      // merge implies multiple-open; single mode keeps the last per normalize.
      commit([...store.getState(), ...keys])
    },
    expandAll(keys) {
      if (keys.length === 0) return
      if (mode === 'single') {
        commit([keys[keys.length - 1]!])
        return
      }
      commit([...store.getState(), ...keys])
    },
    collapseAll() {
      if (index.size === 0) return
      commit([])
    },
  }
}
