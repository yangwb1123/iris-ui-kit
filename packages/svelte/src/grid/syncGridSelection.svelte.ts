import { get, writable, type Readable } from 'svelte/store'
import type { ReadonlyStore } from '@iris-ui-kit/core'
import type {
  GridFilteringModel,
  GridFilteringState,
  GridFilterValues,
  GridSortingModel,
  GridSortingState,
  SelectionKey,
  SelectionModel,
  SortState,
} from '@iris-ui-kit/core/grid'

interface GridSelectionBridgeOptions<K extends SelectionKey> {
  value?: readonly K[]
}

interface GridSortingBridgeOptions {
  sort?: SortState | null
  multiSortState?: readonly SortState[]
}

interface GridFilteringBridgeOptions {
  filters?: Readonly<Record<string, string>>
  filterValues?: Readonly<GridFilterValues>
}

interface ControlledChannel<S, T> {
  store: ReadonlyStore<S>
  select(state: S): T
  read(): T | undefined
  sync(value: T): void
  clone(value: T): T
  equals(left: T, right: T): boolean
  track?(value: T): void
}

/**
 * Bridge one controlled channel while retaining the last accepted snapshots.
 *
 * The model is still the source of uncontrolled changes. While controlled, a
 * model mutation is only a proposal: the readable mirrors the prop and the
 * proposal is deliberately not recorded as an uncontrolled snapshot. On a
 * handoff, the model is silently rebased before the restored value is exposed.
 */
function syncControlledChannel<S, T>(channel: ControlledChannel<S, T>): Readable<T> {
  const modelInitial = channel.clone(channel.select(channel.store.getState()))
  const controlledInitial = channel.read()
  const initial = controlledInitial === undefined ? modelInitial : channel.clone(controlledInitial)
  const outputStore = writable<T>(channel.clone(initial))
  const output: Readable<T> = {
    subscribe: (run) => outputStore.subscribe(run),
  }
  let wasControlled = controlledInitial !== undefined
  let hasUncontrolledSnapshot = !wasControlled
  let uncontrolledSnapshot = channel.clone(initial)
  let lastControlledSnapshot = channel.clone(initial)

  const publish = (value: T, repair = false): void => {
    const next = channel.clone(value)
    // The published snapshot is mutable from the consumer's point of view.
    // Compare against the store's actual value so a sibling notification can
    // repair an externally mutated uncontrolled snapshot even when the bridge
    // already accepted the same canonical value.
    if (!repair && channel.equals(get(outputStore), next)) return
    // Keep the store's value independent from the comparison snapshot and the
    // input prop. This preserves the bridge's copied-value semantics.
    outputStore.set(channel.clone(next))
  }

  // Keep the readable live for both model mutations and controlled proposals.
  // Reading the prop in the callback makes a controlled proposal invisible to
  // the readable without treating it as a genuine uncontrolled snapshot.
  $effect(() => {
    const unsubscribe = channel.store.subscribe((state) => {
      const controlled = channel.read()
      if (controlled !== undefined) {
        // A consumer can mutate the last published clone. Re-emit controlled
        // values on model notifications so a rejected proposal repairs that
        // published snapshot as well.
        publish(controlled, true)
        return
      }
      // Several channels can share a model store. During a handoff, another
      // channel may emit before this channel's own rebase runs; that emission
      // is not an uncontrolled mutation and must not capture a proposal or
      // expose an uncontrolled value before this channel is rebased.
      if (wasControlled) return
      const next = channel.clone(channel.select(state))
      uncontrolledSnapshot = channel.clone(next)
      hasUncontrolledSnapshot = true
      publish(next)
    })
    return unsubscribe
  })

  // Read the live props proxy on every effect run. Tracking the value's contents
  // also supports rune props whose caller mutates an array/map in place.
  $effect(() => {
    const controlled = channel.read()
    const isControlled = controlled !== undefined
    if (isControlled) {
      channel.track?.(controlled)
      const next = channel.clone(controlled)
      lastControlledSnapshot = channel.clone(next)
      channel.sync(next)
      publish(next, true)
    } else if (wasControlled) {
      const restore = channel.clone(
        hasUncontrolledSnapshot ? uncontrolledSnapshot : lastControlledSnapshot,
      )
      channel.sync(restore)
      // sync() may not emit when the proposal already equals the snapshot.
      // Record the rebased value explicitly so a later handoff cannot lose it.
      uncontrolledSnapshot = channel.clone(restore)
      hasUncontrolledSnapshot = true
      publish(restore)
    }
    wasControlled = isControlled
  })

  return output
}

/** Install the Svelte rune bridge for a controlled grid selection prop. */
export function syncGridSelection<K extends SelectionKey>(
  model: SelectionModel<K>,
  read: () => GridSelectionBridgeOptions<K>,
): Readable<K[]> {
  return syncControlledChannel<K[], K[]>({
    store: model.store,
    select: (keys) => keys,
    read: () => {
      const value = read().value
      return value === undefined ? undefined : [...value]
    },
    sync: (keys) => model.sync(keys),
    clone: (keys) => [...keys],
    equals: sameKeys,
    track: (keys) => void JSON.stringify(keys),
  })
}

/** Install the Svelte rune bridges for controlled sorting channels. */
export function syncGridSorting(
  model: GridSortingModel,
  read: () => GridSortingBridgeOptions,
): { sort: Readable<SortState | null>; multiSort: Readable<SortState[]> } {
  const sort = syncControlledChannel<GridSortingState, SortState | null>({
    store: model.store,
    select: (state) => state.sort,
    read: () => read().sort,
    sync: (value) => model.syncSort(value),
    clone: cloneSort,
    equals: sameSort,
    track: (value) => void JSON.stringify(value),
  })
  const multiSort = syncControlledChannel<GridSortingState, SortState[]>({
    store: model.store,
    select: (state) => state.multiSort,
    read: () => {
      const value = read().multiSortState
      return value === undefined ? undefined : [...value]
    },
    sync: (value) => model.syncMultiSort(value),
    clone: cloneSorts,
    equals: sameSorts,
    track: (value) => void JSON.stringify(value),
  })
  return { sort, multiSort }
}

/** Install the Svelte rune bridges for controlled filtering channels. */
export function syncGridFiltering(
  model: GridFilteringModel,
  read: () => GridFilteringBridgeOptions,
): { filters: Readable<Record<string, string>>; filterValues: Readable<GridFilterValues> } {
  const filters = syncControlledChannel<GridFilteringState, Record<string, string>>({
    store: model.store,
    select: (state) => state.filters,
    read: () => {
      const value = read().filters
      return value === undefined ? undefined : { ...value }
    },
    sync: (value) => model.syncFilters(value),
    clone: (value) => ({ ...value }),
    equals: sameFilters,
    track: (value) => void JSON.stringify(Object.entries(value)),
  })
  const filterValues = syncControlledChannel<GridFilteringState, GridFilterValues>({
    store: model.store,
    select: (state) => state.filterValues,
    read: () => {
      const value = read().filterValues
      return value === undefined ? undefined : cloneFilterValues(value)
    },
    sync: (value) => model.syncFilterValues(value),
    clone: cloneFilterValues,
    equals: sameFilterValues,
    track: (value) => void JSON.stringify(Object.entries(value)),
  })
  return { filters, filterValues }
}

function cloneSort(sort: SortState | null): SortState | null {
  return sort ? { ...sort } : null
}

function cloneSorts(sorts: readonly SortState[]): SortState[] {
  return sorts.map((sort) => ({ ...sort }))
}

function sameSort(left: SortState | null, right: SortState | null): boolean {
  return left?.key === right?.key && left?.direction === right?.direction
}

function sameSorts(left: readonly SortState[], right: readonly SortState[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (sort, index) => sort.key === right[index]?.key && sort.direction === right[index]?.direction,
    )
  )
}

function sameFilters(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.is(left[key], right[key]))
  )
}

function cloneFilterValues(values: Readonly<GridFilterValues>): GridFilterValues {
  return Object.fromEntries(Object.entries(values).map(([key, entries]) => [key, [...entries]]))
}

function sameFilterValues(
  left: Readonly<GridFilterValues>,
  right: Readonly<GridFilterValues>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        right[key] !== undefined &&
        left[key]!.length === right[key]!.length &&
        left[key]!.every((value, index) => Object.is(value, right[key]![index])),
    )
  )
}

function sameKeys<K extends SelectionKey>(left: readonly K[], right: readonly K[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (key, index) => key === right[index] || (key !== key && right[index] !== right[index]),
    )
  )
}
