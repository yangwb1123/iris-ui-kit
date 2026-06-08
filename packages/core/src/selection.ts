import { createStore, type Store } from './store'

/**
 * Framework-agnostic selection model — the A-layer **core behavior** shared by
 * List, Tree, Table, Select, Combobox, TreeSelect, ToggleGroup, Transfer and the
 * ProTable plugin (each previously re-implemented keyed selection per framework).
 * Owns a set of selected keys with single/multiple semantics and page-scoped
 * select-all. Generic over the key type `K` (`string | number`) so it fits
 * components whose values are string keys, numeric ids, or a mix.
 *
 * It is **uncontrolled-internal** (owns its store) and always fires `onChange`.
 * For a controlled component, the adapter owns the controlled cell and calls
 * {@link SelectionModel.set} from an effect when the prop changes — the model
 * stays simple and framework-agnostic. Retrofitting a component onto it is a net
 * simplification: the controlled/uncontrolled + toggle logic moves here.
 */
export type SelectionMode = 'single' | 'multiple'

export type SelectionKey = string | number

export interface SelectionConfig<K extends SelectionKey = string> {
  mode?: SelectionMode
  /** Initial selection (uncontrolled seed). */
  defaultSelected?: K[]
  /** Notified with the next selection on every change. */
  onChange?: (keys: K[]) => void
}

export interface SelectionModel<K extends SelectionKey = string> {
  store: Store<K[]>
  /** Current selected keys (order of insertion). */
  get(): K[]
  isSelected(key: K): boolean
  /** Toggle a key. In `single` mode, selecting replaces; re-toggling clears. */
  toggle(key: K): void
  select(key: K): void
  deselect(key: K): void
  /** Replace the whole selection (fires `onChange`). In `single` mode keeps at most the last key. */
  set(keys: K[]): void
  /**
   * Replace internal state WITHOUT firing `onChange` — for controlled adapters
   * mirroring a prop into the model from an effect (avoids an onChange echo).
   */
  sync(keys: K[]): void
  /** Select-all / clear over a specific set of keys (e.g. the current page). */
  toggleAll(keys: readonly K[]): void
  /** True when every key in `keys` is selected (and `keys` is non-empty). */
  isAllSelected(keys: readonly K[]): boolean
  clear(): void
}

export function createSelectionModel<K extends SelectionKey = string>(
  config: SelectionConfig<K> = {},
): SelectionModel<K> {
  const mode: SelectionMode = config.mode ?? 'multiple'
  const store = createStore<K[]>(normalize(config.defaultSelected ?? [], mode))

  function commit(next: K[]): void {
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
    sync(keys) {
      store.setState(normalize(keys, mode))
    },
    toggleAll(keys) {
      const cur = store.getState()
      const allOn = keys.length > 0 && keys.every((k) => cur.includes(k))
      if (allOn) {
        const drop = new Set<K>(keys)
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
function normalize<K extends SelectionKey>(keys: K[], mode: SelectionMode): K[] {
  const deduped = Array.from(new Set(keys))
  if (mode === 'single' && deduped.length > 1) return [deduped[deduped.length - 1]!]
  return deduped
}
