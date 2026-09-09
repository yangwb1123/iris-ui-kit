<script lang="ts">
  import {
    GRID_PAGINATION_CHANGE_EVENT,
    type GridPaginationChange,
    type GridPaginationModel,
  } from '@iris-ui-kit/core/grid'
  import type { Readable } from 'svelte/store'
  import { useGridCore, useGridPagination, type UseGridPaginationOptions } from './useGrid'

  interface PaginationController {
    model: GridPaginationModel
    pagination: Readable<ReturnType<GridPaginationModel['get']>>
    setPage(page: number): void
    setPageSize(pageSize: number): void
    setPagination(page: number, pageSize: number): void
  }

  interface Props extends UseGridPaginationOptions {
    onEvent?: (change: GridPaginationChange) => void
    onModel?: (model: GridPaginationModel) => void
    onPagination?: (pagination: PaginationController) => void
  }

  let props: Props = $props()

  const core = useGridCore()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const pagination = useGridPagination(core, props)
  const paginationStore = pagination.pagination
  core.on<GridPaginationChange>(GRID_PAGINATION_CHANGE_EVENT, (change) => props.onEvent?.(change))
  const reportModel = (): void => props.onModel?.(pagination.model)
  const reportPagination = (): void => props.onPagination?.(pagination)
  reportModel()
  reportPagination()
</script>

<output data-testid="page">{$paginationStore.page}</output>
<output data-testid="page-size">{$paginationStore.pageSize}</output>
<output data-testid="total">{$paginationStore.total}</output>
