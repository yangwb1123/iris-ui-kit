<script lang="ts">
  import {
    GRID_SELECTION_CHANGE_EVENT,
    GRID_SORTING_CHANGE_EVENT,
    type GridSortingModel,
    type SelectionModel,
    type SortState,
  } from '@iris-ui-kit/core/grid'
  import type { Store } from '@iris-ui-kit/core'
  import type { Readable } from 'svelte/store'
  import {
    useGridCore,
    useGridSelection,
    useGridSorting,
    type UseGridSelectionOptions,
    type UseGridSortingOptions,
  } from './useGrid'

  type Bridge = {
    selection: {
      model: SelectionModel<string>
      value: Readable<string[]>
    }
    sorting: {
      model: GridSortingModel
      value: Readable<SortState | null>
    }
  }

  interface Props {
    onReady?: (bridge: Bridge) => void
    onSelectionChange?: (keys: string[]) => void
    onSortChange?: (sort: SortState | null) => void
    onSelectionEvent?: (payload: unknown) => void
    onSortingEvent?: (payload: unknown) => void
  }

  let props: Props = $props()
  let selectionOptions = $state<UseGridSelectionOptions<string>>({
    defaultValue: ['a'],
    onChange: (keys) => props.onSelectionChange?.(keys),
  })
  let sortingOptions = $state<UseGridSortingOptions>({
    defaultSort: { key: 'name', direction: 'asc' },
    onSortChange: (sort) => props.onSortChange?.(sort),
  })

  const core = useGridCore<{ id: string }>()
  const selection = useGridSelection(core, selectionOptions)
  const sorting = useGridSorting(core, sortingOptions)
  const selected = selection.selection
  const sort = sorting.sort

  core.on(GRID_SELECTION_CHANGE_EVENT, (payload) => props.onSelectionEvent?.(payload))
  core.on(GRID_SORTING_CHANGE_EVENT, (payload) => props.onSortingEvent?.(payload))

  const reportReady = (): void =>
    props.onReady?.({
      selection: { model: selection.model, value: selected },
      sorting: { model: sorting.model, value: sort },
    })
  reportReady()

  const handoffSelection = (): void => {
    // Selection intentionally exposes a read-only store; exercise its runtime
    // Store.batch boundary without widening the public model API.
    const store = selection.model.store as unknown as Store<string[]>
    store.batch(() => {
      selection.model.set(['b'])
      selectionOptions.value = ['c']
    })
  }

  const handoffSort = (): void => {
    sorting.model.store.batch(() => {
      sorting.model.setSort({ key: 'age', direction: 'desc' })
      sortingOptions.sort = { key: 'status', direction: 'asc' }
    })
  }

  const releaseSelection = (): void => {
    selectionOptions.value = undefined
  }

  const releaseSort = (): void => {
    sortingOptions.sort = undefined
  }
</script>

<output data-testid="selection">{JSON.stringify($selected)}</output>
<output data-testid="sort">{JSON.stringify($sort)}</output>
<button type="button" data-testid="handoff-selection" onclick={handoffSelection}
  >handoff selection</button
>
<button type="button" data-testid="release-selection" onclick={releaseSelection}
  >release selection</button
>
<button type="button" data-testid="handoff-sort" onclick={handoffSort}>handoff sort</button>
<button type="button" data-testid="release-sort" onclick={releaseSort}>release sort</button>
