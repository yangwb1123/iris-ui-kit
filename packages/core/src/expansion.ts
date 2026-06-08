import { createStore, type Store } from './store'

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

export interface ExpansionConfig {
  mode?: ExpansionMode
  defaultExpanded?: string[]
  onChange?: (keys: string[]) => void
}

export interface ExpansionModel {
  store: Store<string[]>
  get(): string[]
  isExpanded(key: string): boolean
  toggle(key: string): void
  expand(key: string): void
  collapse(key: string): void
  set(keys: string[]): void
  /** Union `keys` into the current set (no removals). No-op if all present. */
  merge(keys: string[]): void
}

export function createExpansion(config: ExpansionConfig = {}): ExpansionModel {
  const mode: ExpansionMode = config.mode ?? 'multiple'
  const store = createStore<string[]>(normalize(config.defaultExpanded ?? [], mode))

  function commit(next: string[]): void {
    const value = normalize(next, mode)
    store.setState(value)
    config.onChange?.(value)
  }

  return {
    store,
    get: store.getState,
    isExpanded: (key) => store.getState().includes(key),
    toggle(key) {
      const cur = store.getState()
      if (cur.includes(key)) {
        commit(cur.filter((k) => k !== key))
      } else {
        commit(mode === 'single' ? [key] : [...cur, key])
      }
    },
    expand(key) {
      const cur = store.getState()
      if (cur.includes(key)) return
      commit(mode === 'single' ? [key] : [...cur, key])
    },
    collapse(key) {
      commit(store.getState().filter((k) => k !== key))
    },
    set(keys) {
      commit(keys)
    },
    merge(keys) {
      const cur = store.getState()
      if (keys.every((k) => cur.includes(k))) return
      // merge implies multiple-open; single mode keeps the last per normalize.
      commit([...cur, ...keys])
    },
  }
}

function normalize(keys: string[], mode: ExpansionMode): string[] {
  const deduped = Array.from(new Set(keys))
  if (mode === 'single' && deduped.length > 1) return [deduped[deduped.length - 1]]
  return deduped
}
