import { createEffect, onCleanup, type Accessor } from 'solid-js'
import {
  createGridPaginationFeature,
  createGridPaginationProjection,
  type GridCore,
  type GridPaginationChange,
  type GridPaginationModel,
  type GridPaginationState,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface UseGridPaginationOptions {
  page?: number
  defaultPage?: number
  pageSize?: number
  defaultPageSize?: number
  total?: number
  defaultTotal?: number
  onChange?: (change: GridPaginationChange) => void
}

function controlledPagination(options: UseGridPaginationOptions): Partial<GridPaginationState> {
  return {
    ...(options.page !== undefined ? { page: options.page } : {}),
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
    ...(options.total !== undefined ? { total: options.total } : {}),
  }
}
export function useGridPagination<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridPaginationOptions = {},
): {
  model: GridPaginationModel
  pagination: Accessor<GridPaginationState>
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
} {
  const latest = options
  const model = useGridFeature<Row, GridPaginationModel>(
    core,
    'pagination',
    'getPaginationModel',
    () =>
      createGridPaginationFeature<Row>({
        defaultPage: options.page ?? options.defaultPage,
        defaultPageSize: options.pageSize ?? options.defaultPageSize,
        defaultTotal: options.total ?? options.defaultTotal,
        onChange: (v) => latest.onChange?.(v),
      }),
  )
  const internal = useStore(model.store)
  const projection = createGridPaginationProjection(model, controlledPagination(options))
  createEffect(() => {
    projection.sync(controlledPagination(options))
  })
  onCleanup(() => projection.dispose())
  return {
    model,
    pagination: () => projection.project(internal(), controlledPagination(options)),
    setPage: (v) => {
      projection.sync(controlledPagination(options))
      model.setPage(v)
    },
    setPageSize: (v) => {
      projection.sync(controlledPagination(options))
      model.setPageSize(v)
    },
    setPagination: (page, size) => {
      projection.sync(controlledPagination(options))
      model.set(page, size)
    },
  }
}
