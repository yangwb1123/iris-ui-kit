import { createStore, type Store } from './store'

/**
 * Framework-agnostic selection model — the A-layer **core behavior** shared by
 * List, Tree, Table, Select, Combobox, TreeSelect, Tree-Select and the ProTable
 * plugin (today each re-implements keyed selection per framework). Owns a set of
 * selected keys with single/multiple semantics and page-scoped select-all.
 *
 * It is **uncontrolled-internal** (owns its store) and always fires `onChange`.
 * For a controlled component, the adapter owns the controlled cell and calls
 * {@link SelectionModel.set} from an effect when the prop changes — the model
 * stays simple and framework-agnostic.
 */
export type SelectionMode = 'single' | 'multiple'

export interface SelectionConfig {
  mode?: SelectionMode
  /** Initial selection (uncontrolled seed). */
  defaultSelected?: string[]
  /** Notified with the next selection on every change. */
  onChange?: (keys: string[]) => void
}

export interface SelectionModel {
  store: Store<string[]>
  /** Current selected keys (order of insertion). */
  get(): string[]
  isSelected(key: string): boolean
  /** Toggle a key. In `single` mode, selecting replaces; re-toggling clears. */
  toggle(key: string): void
  select(key: string): void
  deselect(key: string): void
  /** Replace the whole selection. In `single` mode keeps at most the last key. */
  set(keys: string[]): void
  /** Select-all / clear over a specific set of keys (e.g. the current page). */
  toggleAll(keys: readonly string[]): void
  /** True when every key in `keys` is selected (and `keys` is non-empty). */
  isAllSelected(keys: readonly string[]): boolean
  clear(): void
}

export function createSelectionModel(config: SelectionConfig = {}): SelectionModel {
  const mode: SelectionMode = config.mode ?? 'multiple'
  const store = createStore<string[]>(normalize(config.defaultSelected ?? [], mode))

  function commit(next: string[]): void {
    const value = normalize(next, mode)
    store.setState(value)
    config.onChange?.(value)
  }

  return {
    store,
    get: store.getState,
    isSelected: (key) => store.getState().includes(key),
    toggle(key) {
      const cur = store.getState()
      if (mode === 'single') {
        commit(cur.includes(key) ? [] : [key])
        return
      }
      commit(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
    },
    select(key) {
      const cur = store.getState()
      if (cur.includes(key)) return
      commit(mode === 'single' ? [key] : [...cur, key])
    },
    deselect(key) {
      commit(store.getState().filter((k) => k !== key))
    },
    set(keys) {
      commit(keys)
    },
    toggleAll(keys) {
      const cur = store.getState()
      const allOn = keys.length > 0 && keys.every((k) => cur.includes(k))
      if (allOn) {
        const drop = new Set(keys)
        commit(cur.filter((k) => !drop.has(k)))
      } else {
        commit([...cur, ...keys])
      }
    },
    isAllSelected(keys) {
      const cur = store.getState()
      return keys.length > 0 && keys.every((k) => cur.includes(k))
    },
    clear() {
      commit([])
    },
  }
}

/** Dedupe (preserve order); in single mode keep at most the last key. */
function normalize(keys: string[], mode: SelectionMode): string[] {
  const deduped = Array.from(new Set(keys))
  if (mode === 'single' && deduped.length > 1) return [deduped[deduped.length - 1]]
  return deduped
}
