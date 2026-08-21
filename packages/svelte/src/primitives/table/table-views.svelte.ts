import { readTableViews, writeTableViews } from '@iris-ui-kit/core'
import type { IrisTableProps } from './props'
import type {
  IrisTableNamedView,
  IrisTableSortState,
  IrisTableTab,
  IrisTableViewSnapshot,
} from './types'

/** Keeps named-view persistence and tab selection out of the table renderer. */
export function createTableViewsController(options: {
  config: () => IrisTableProps['views']
  sort: () => IrisTableSortState | null
  applySort: (sort: IrisTableSortState | null) => void
  onActiveViewChange?: (key: string | null) => void
}): {
  readonly viewList: IrisTableNamedView[]
  readonly activeViewKey: string | null
  readonly activeTab: string | null
  selectView: (key: string) => void
  saveView: (name: string) => void
  deleteView: (key: string) => void
  applyTableTab: (tab: IrisTableTab) => void
} {
  let viewList = $state<IrisTableNamedView[]>(readTableViews(options.config()))
  let internalActiveView = $state<string | null>(null)
  let activeTab = $state<string | null>(null)
  const activeViewConfig = $derived(options.config())
  const activeViewKey = $derived(
    activeViewConfig?.activeKey !== undefined
      ? (activeViewConfig.activeKey ?? null)
      : internalActiveView,
  )

  function persist(next: IrisTableNamedView[]): void {
    viewList = next
    writeTableViews(options.config(), next)
  }

  function selectView(key: string): void {
    const view = viewList.find((candidate) => candidate.name === key)
    if (!view) return
    const snapshot = view.snapshot as IrisTableViewSnapshot
    if (Object.prototype.hasOwnProperty.call(snapshot, 'sort'))
      options.applySort(snapshot.sort ?? null)
    internalActiveView = key
    options.onActiveViewChange?.(key)
  }

  function saveView(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    const currentSort = options.sort()
    const entry: IrisTableNamedView = {
      name: trimmed,
      snapshot: { sort: currentSort ? { ...currentSort } : null },
    }
    const index = viewList.findIndex((view) => view.name === trimmed)
    persist(
      index < 0 ? [...viewList, entry] : viewList.map((view, i) => (i === index ? entry : view)),
    )
    internalActiveView = trimmed
    options.onActiveViewChange?.(trimmed)
  }

  function deleteView(key: string): void {
    persist(viewList.filter((view) => view.name !== key))
    if (activeViewKey === key) {
      internalActiveView = null
      options.onActiveViewChange?.(null)
    }
  }

  function applyTableTab(tab: IrisTableTab): void {
    activeTab = tab.key
    for (const name of tab.views ?? []) selectView(name)
  }

  return {
    get viewList() {
      return viewList
    },
    get activeViewKey() {
      return activeViewKey
    },
    get activeTab() {
      return activeTab
    },
    selectView,
    saveView,
    deleteView,
    applyTableTab,
  }
}
