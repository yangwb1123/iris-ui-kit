<script lang="ts">
  import {
    GRID_FILTERING_CHANGE_EVENT,
    GRID_SELECTION_CHANGE_EVENT,
    GRID_SORTING_CHANGE_EVENT,
    type GridCore,
    type GridFilteringModel,
    type GridSortingModel,
    type SelectionModel,
    type SortState,
  } from '@iris-ui-kit/core/grid'
  import type { Readable } from 'svelte/store'
  import {
    useGridCore,
    useGridFiltering,
    useGridSelection,
    useGridSorting,
    type UseGridFilteringOptions,
    type UseGridSelectionOptions,
    type UseGridSelectionResult,
    type UseGridSortingOptions,
  } from './useGrid'

  type Row = { id: string }

  interface Props
    extends UseGridSelectionOptions<string>, UseGridSortingOptions, UseGridFilteringOptions {
    onCore?: (core: GridCore<Row>) => void
    onModel?: (model: SelectionModel<string>) => void
    onSelection?: (selection: Readable<string[]>) => void
    onSelectionResult?: (selection: UseGridSelectionResult<string>) => void
    onSortingModel?: (model: GridSortingModel) => void
    onFilteringModel?: (model: GridFilteringModel) => void
    onSort?: (sort: Readable<SortState | null>) => void
    onMultiSort?: (sorts: Readable<SortState[]>) => void
    onCycleSort?: (cycle: (key: string) => void) => void
    onCycleMultiSort?: (cycle: (key: string) => void) => void
    onFilters?: (filters: Readable<Record<string, string>>) => void
    onFilterValues?: (values: Readable<Record<string, string[]>>) => void
    onSelectionEvent?: (payload: unknown) => void
    onSortingEvent?: (payload: unknown) => void
    onFilteringEvent?: (payload: unknown) => void
  }

  // Keep the $props proxy intact so all controlled bridges can observe updates.
  let props: Props = $props()

  const core = useGridCore<Row>()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridges.
  const selection = useGridSelection<Row, string>(core, props)
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const sorting = useGridSorting<Row>(core, props)
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const filtering = useGridFiltering<Row>(core, props)
  const selected = selection.selection
  const sort = sorting.sort
  const multiSort = sorting.multiSort
  const filters = filtering.filters
  const filterValues = filtering.filterValues

  core.on(GRID_SELECTION_CHANGE_EVENT, (payload) => props.onSelectionEvent?.(payload))
  core.on(GRID_SORTING_CHANGE_EVENT, (payload) => props.onSortingEvent?.(payload))
  core.on(GRID_FILTERING_CHANGE_EVENT, (payload) => props.onFilteringEvent?.(payload))

  const reportCore = (): void => props.onCore?.(core)
  const reportModel = (): void => props.onModel?.(selection.model)
  const reportSelection = (): void => props.onSelection?.(selected)
  const reportSelectionResult = (): void => props.onSelectionResult?.(selection)
  const reportSortingModel = (): void => props.onSortingModel?.(sorting.model)
  const reportFilteringModel = (): void => props.onFilteringModel?.(filtering.model)
  const reportSort = (): void => props.onSort?.(sort)
  const reportMultiSort = (): void => props.onMultiSort?.(multiSort)
  const reportCycleSort = (): void => props.onCycleSort?.(sorting.cycleSort)
  const reportCycleMultiSort = (): void => props.onCycleMultiSort?.(sorting.cycleMultiSort)
  const reportFilters = (): void => props.onFilters?.(filters)
  const reportFilterValues = (): void => props.onFilterValues?.(filterValues)
  reportCore()
  reportModel()
  reportSelection()
  reportSelectionResult()
  reportSortingModel()
  reportFilteringModel()
  reportSort()
  reportMultiSort()
  reportCycleSort()
  reportCycleMultiSort()
  reportFilters()
  reportFilterValues()
</script>

<output data-testid="selection">{JSON.stringify($selected)}</output>
<output data-testid="sort">{JSON.stringify($sort)}</output>
<output data-testid="multi-sort">{JSON.stringify($multiSort)}</output>
<output data-testid="filters">{JSON.stringify($filters)}</output>
<output data-testid="filter-values">{JSON.stringify($filterValues)}</output>
<button type="button" data-testid="toggle-b" onclick={() => selection.model.toggle('b')}
  >toggle b</button
>
