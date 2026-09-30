import type { IrisTableProps } from './props'

type TableRow = Record<string, unknown>

type LazyTreeRows = {
  setChildren: (key: string | number, children: TableRow[]) => boolean
  find: (key: string | number) => TableRow | undefined
}

export function createTableLazyLoadController(options: {
  getBaseData: () => TableRow[]
  getLiveRows: () => TableRow[]
  getLoader: () => IrisTableProps['lazyLoad']
  rows: LazyTreeRows
  getBodyData: () => unknown
  toggleExpanded: (key: string) => void
}): {
  readonly lazyLoading: Set<string>
  hasLazyChildren: (row: TableRow, key: string) => boolean
  loadLazyChildren: (row: TableRow, key: string, effectiveKey: string | number) => void
} {
  let lazyLoading = $state<Set<string>>(new Set())
  let lazyLoaded = $state<Set<string>>(new Set())
  let lazyEpoch = 0
  let lastLazySource: TableRow[] | undefined
  let lazyWriteSource: TableRow[] | undefined

  $effect(() => {
    const source = options.getBaseData()
    if (source !== lastLazySource) {
      const isLazyWrite = source === lazyWriteSource
      lastLazySource = source
      lazyEpoch += 1
      lazyLoading = new Set()
      if (!isLazyWrite) lazyLoaded = new Set()
      lazyWriteSource = undefined
    }
  })

  const hasLazyChildren = (row: TableRow, key: string): boolean => {
    if (options.getLoader() === undefined || !Array.isArray(row.children)) return false
    return row.children.length > 0 || lazyLoaded.has(key)
  }

  function loadLazyChildren(row: TableRow, key: string, effectiveKey: string | number): void {
    const loadChildren = options.getLoader()
    if (loadChildren === undefined || hasLazyChildren(row, key) || lazyLoading.has(key)) return
    const requestEpoch = lazyEpoch
    lazyLoading = new Set(lazyLoading).add(key)
    let loaded = false
    const load = (children: TableRow[]): void => {
      if (loaded || requestEpoch !== lazyEpoch) return
      loaded = true
      const committed = options.rows.setChildren(effectiveKey, children)
      if (!committed) {
        const current = options.rows.find(effectiveKey)
        const loadedEmpty =
          current !== undefined && Array.isArray(current.children) && current.children.length === 0
        if (!loadedEmpty) {
          if (requestEpoch === lazyEpoch) {
            const next = new Set(lazyLoading)
            next.delete(key)
            lazyLoading = next
          }
          return
        }
      }
      lazyLoaded = new Set(lazyLoaded).add(key)
      lazyWriteSource = options.getLiveRows()
      void options.getBodyData()
      options.toggleExpanded(key)
      const next = new Set(lazyLoading)
      next.delete(key)
      lazyLoading = next
    }
    try {
      loadChildren(row, load)
    } catch {
      if (requestEpoch === lazyEpoch) {
        const next = new Set(lazyLoading)
        next.delete(key)
        lazyLoading = next
      }
    }
  }

  return {
    get lazyLoading() {
      return lazyLoading
    },
    hasLazyChildren,
    loadLazyChildren,
  }
}
