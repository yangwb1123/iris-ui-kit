import type { IrisTableHandle, IrisTableProxyQueryParams } from './types'

export interface TableHandleOptions {
  setRows: (rows: Array<Record<string, unknown>>) => void
  onDataChange?: (rows: Array<Record<string, unknown>>) => void
  removeRows: (keys: Array<string | number>) => void
  getFilteredData: () => Array<Record<string, unknown>>
  exportCurrentViewCsv: () => string
  exportMultiCsv: () => string
  compareStates: (a: string, b: string) => string
  refetch: () => void
  setParams: (overrides: Partial<IrisTableProxyQueryParams>) => void
  getProxyInfo: () => { page: number; pageSize: number; total: number } | null
  clearSort: () => void
  clearFilter: () => void
  getRoot: () => HTMLElement | null
}

/** Stable imperative facade; all stateful reads/writes remain adapter-owned. */
export function createTableHandle(
  options: TableHandleOptions,
): IrisTableHandle & { dispose: () => void } {
  let rowTargetTimer: ReturnType<typeof setTimeout> | undefined
  const findTableRow = (key: string | number): HTMLElement | null => {
    const root = options.getRoot()
    if (!root) return null
    const keyString = String(key)
    return (
      Array.from(root.querySelectorAll<HTMLElement>('[data-iris-table-row-key]')).find(
        (node) => node.getAttribute('data-iris-table-row-key') === keyString,
      ) ?? null
    )
  }
  const scrollToRow = (key: string | number): void => {
    findTableRow(key)?.scrollIntoView?.({ block: 'nearest' })
  }
  const goToRow = (key: string | number): void => {
    const row = findTableRow(key)
    if (!row) return
    row.scrollIntoView?.({ block: 'nearest' })
    const root = options.getRoot()
    root?.querySelector('[data-iris-row-target="true"]')?.removeAttribute('data-iris-row-target')
    row.setAttribute('data-iris-row-target', 'true')
    if (rowTargetTimer !== undefined) clearTimeout(rowTargetTimer)
    rowTargetTimer = setTimeout(() => {
      rowTargetTimer = undefined
      row.removeAttribute('data-iris-row-target')
    }, 2000)
  }
  const dispose = (): void => {
    if (rowTargetTimer !== undefined) clearTimeout(rowTargetTimer)
    rowTargetTimer = undefined
  }
  return {
    loadData(rows) {
      const next = [...rows]
      options.setRows(next)
      options.onDataChange?.(next)
    },
    reloadData() {
      options.refetch()
    },
    commitProxy(overrides) {
      options.setParams(overrides)
    },
    removeRows(keys) {
      options.removeRows(keys)
    },
    getFilteredData() {
      return [...options.getFilteredData()]
    },
    exportCurrentViewCsv() {
      return options.exportCurrentViewCsv()
    },
    exportMultiCsv() {
      return options.exportMultiCsv()
    },
    compareStates(a, b) {
      return options.compareStates(a, b)
    },
    getProxyInfo() {
      return options.getProxyInfo()
    },
    clearSort: options.clearSort,
    clearFilter: options.clearFilter,
    scrollToRow,
    goToRow,
    dispose,
  }
}
