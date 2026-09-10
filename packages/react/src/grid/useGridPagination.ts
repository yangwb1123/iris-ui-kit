import * as React from 'react'
import {
  createGridPaginationFeature,
  createGridPaginationProjection,
  type GridCore,
  type GridPaginationChange,
  type GridPaginationModel,
  type GridPaginationProjection,
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

export interface UseGridPaginationResult {
  model: GridPaginationModel
  pagination: GridPaginationState
  controlled: boolean
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
}

function controlledState(options: UseGridPaginationOptions): Partial<GridPaginationState> {
  return {
    ...(options.page !== undefined ? { page: options.page } : {}),
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
    ...(options.total !== undefined ? { total: options.total } : {}),
  }
}

/** Installs pagination in Grid Core and mirrors optional controlled proxy state. */
export function useGridPagination<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridPaginationOptions = {},
): UseGridPaginationResult {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridPaginationModel>(
    core,
    'pagination',
    'getPaginationModel',
    () =>
      createGridPaginationFeature<Row>({
        defaultPage: options.page ?? options.defaultPage,
        defaultPageSize: options.pageSize ?? options.defaultPageSize,
        defaultTotal: options.total ?? options.defaultTotal,
        onChange: (change) => latest.current.onChange?.(change),
      }),
  )
  const internal = useStore(model.store)
  const projectionRef = React.useRef<GridPaginationProjection | null>(null)
  if (projectionRef.current === null) {
    projectionRef.current = createGridPaginationProjection(model, controlledState(options))
  }
  const projection = projectionRef.current
  const controlled =
    options.page !== undefined || options.pageSize !== undefined || options.total !== undefined
  const controlledProps = controlledState(options)
  const pagination: GridPaginationState = projection.project(internal, controlledProps)

  React.useEffect(() => {
    projection.sync(controlledState(options))
    return () => projection.dispose()
  }, [options.page, options.pageSize, options.total, projection])

  const rebase = React.useCallback(() => {
    projection.sync(controlledState(latest.current))
  }, [projection])
  const setPage = React.useCallback(
    (page: number) => {
      rebase()
      model.setPage(page)
    },
    [model, rebase],
  )
  const setPageSize = React.useCallback(
    (pageSize: number) => {
      rebase()
      model.setPageSize(pageSize)
    },
    [model, rebase],
  )
  const setPagination = React.useCallback(
    (page: number, pageSize: number) => {
      rebase()
      model.set(page, pageSize)
    },
    [model, rebase],
  )

  return { model, pagination, controlled, setPage, setPageSize, setPagination }
}
