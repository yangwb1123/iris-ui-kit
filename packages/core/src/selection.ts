import { createStore, type ReadonlyStore } from './store'

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
 *
 * ## Internal index safety
 *
 * The model maintains an internal `Set<K>` index for O(1) `isSelected` queries.
 * To protect against stale index state when external code calls
 * `store.setState()` directly (bypassing the model's controlled commit path),
 * the index uses a **version number** that increments on every commit. Each
 * `isSelected()` call checks the version and lazily rebuilds the index from the
 * store array if the version is out of date. This ensures correctness under:
 *
 * - External `store.setState()` calls (e.g. from adapters or plugins)
 * - `batch()` wrapped operations (where intermediate notifications are suppressed)
 * - `sync()` calls (which also bypass commit to avoid onChange echo)
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
  /**
   * The underlying store — read-only view. External code reads via
   * `getState()` and `subscribe()`. Use `select`/`deselect`/`set`/`sync`
   * methods to mutate; direct `setState()` bypasses `onChange` and the
   * normalization logic. The internal index still rebuilds lazily if
   * external code somehow calls `setState` (e.g. via a cast), so
   * correctness is preserved, but it is strongly discouraged.
   */
  store: ReadonlyStore<K[]>
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

  // Membership index kept in sync with the ordered store array. `isSelected` is
  // a per-row, per-render hot path; backing it with a Set turns a table render
  // from O(n²) (n rows × O(n) `includes`) into O(n). The array stays the source
  // of truth for insertion order; the Set is a derived index.
  //
  // Version counter protects against stale index when external code calls
  // store.setState() directly (bypassing commit). The counter is bumped by:
  //   - commit() — the model's own mutation path
  //   - store.subscribe — after every store flush (including external setState)
  //
  // Inside a batch, store.setState updates the state immediately but defers
  // subscribe notification. We detect this by comparing the store state array
  // length against the index size — a mismatch triggers a lazy rebuild.
  let index = new Set<K>(store.getState())
  // The store state array reference at last known-good index.
  let lastState: readonly K[] = store.getState()
  let storeVersion = 0
  let indexVersion = 0

  /**
   * Ensure the index is fresh. Called before every index read.
   * Fast path: version numbers match (O(1)).
   * Slow path: version mismatch OR state length diverged from index size
   * (handles external setState inside a batch where subscribe is deferred).
   */
  const ensureIndex = (): void => {
    const state = store.getState()
    if (indexVersion === storeVersion && state.length === index.size && state === lastState) return
    // Version mismatch or state diverged → rebuild
    index = new Set<K>(state)
    lastState = state
    indexVersion = storeVersion
  }

  store.subscribe((keys) => {
    storeVersion++
    index = new Set<K>(keys)
    indexVersion = storeVersion
  })

  function commit(next: K[]): void {
    const value = normalize(next, mode)
    storeVersion++
    store.setState(value)
    lastState = value
    config.onChange?.(value)
  }

  return {
    store,
    get: store.getState,
    isSelected: (key) => {
      ensureIndex()
      return index.has(key)
    },
    toggle(key) {
      ensureIndex()
      if (mode === 'single') {
        commit(index.has(key) ? [] : [key])
        return
      }
      commit(
        index.has(key) ? store.getState().filter((k) => k !== key) : [...store.getState(), key],
      )
    },
    select(key) {
      ensureIndex()
      if (index.has(key)) return
      commit(mode === 'single' ? [key] : [...store.getState(), key])
    },
    deselect(key) {
      ensureIndex()
      if (!index.has(key)) return
      commit(store.getState().filter((k) => k !== key))
    },
    set(keys) {
      commit(keys)
    },
    sync(keys) {
      store.setState(normalize(keys, mode))
    },
    toggleAll(keys) {
      ensureIndex()
      const allOn = keys.length > 0 && keys.every((k) => index.has(k))
      if (allOn) {
        const drop = new Set<K>(keys)
        commit(store.getState().filter((k) => !drop.has(k)))
      } else {
        commit([...store.getState(), ...keys])
      }
    },
    isAllSelected(keys) {
      ensureIndex()
      return keys.length > 0 && keys.every((k) => index.has(k))
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
