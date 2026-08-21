/** Storage shape used by framework adapters for named table views. */
export interface TableViewStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface TableViewSort {
  key: string
  direction: 'asc' | 'desc'
}

/** Portable snapshot. Adapters may add fields without changing the wire shape. */
export interface TableViewSnapshot {
  sort?: TableViewSort | null
}

export interface TableViewConfig {
  storage?: TableViewStorage | false
  key?: string
  label?: (name: string) => string
  activeKey?: string | null
}

export interface TableNamedView<Snapshot extends TableViewSnapshot = TableViewSnapshot> {
  name: string
  snapshot: Snapshot
}

export interface TableTab {
  key: string
  label: string
  views?: string[]
}

export const TABLE_VIEWS_DEFAULT_KEY = 'iris-table-views'
export const TABLE_VIEWS_SAVE_ITEM = '__iris-save-view'

function defaultStorage(): TableViewStorage | null {
  try {
    const candidate = (globalThis as { localStorage?: TableViewStorage }).localStorage
    return candidate &&
      typeof candidate.getItem === 'function' &&
      typeof candidate.setItem === 'function'
      ? candidate
      : null
  } catch {
    return null
  }
}

function storageFor(config: TableViewConfig, fallback = defaultStorage()): TableViewStorage | null {
  if (config.storage === false) return null
  return config.storage ?? fallback
}

/** Read and sanitize named views. Any storage/JSON failure returns an empty list. */
export function readTableViews<Snapshot extends TableViewSnapshot = TableViewSnapshot>(
  config: TableViewConfig | undefined,
  fallback?: TableViewStorage | null,
): Array<TableNamedView<Snapshot>> {
  if (!config) return []
  const storage = storageFor(config, fallback ?? defaultStorage())
  if (!storage) return []
  let raw: string | null
  try {
    raw = storage.getItem(config.key ?? TABLE_VIEWS_DEFAULT_KEY)
  } catch {
    return []
  }
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const views: Array<TableNamedView<Snapshot>> = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const record = entry as Record<string, unknown>
    const name = record.name
    const snapshot = record.snapshot
    if (typeof name !== 'string' || name.trim() === '' || name === TABLE_VIEWS_SAVE_ITEM) continue
    if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) continue
    views.push({ name, snapshot: snapshot as Snapshot })
  }
  return views
}

/** Persist a complete list; storage errors are intentionally fail-inert. */
export function writeTableViews(
  config: TableViewConfig | undefined,
  views: readonly TableNamedView[],
  fallback?: TableViewStorage | null,
): void {
  if (!config) return
  const storage = storageFor(config, fallback ?? defaultStorage())
  if (!storage) return
  try {
    storage.setItem(config.key ?? TABLE_VIEWS_DEFAULT_KEY, JSON.stringify(views))
  } catch {
    // Quota/security errors must never break table interaction.
  }
}

/** Keep the first occurrence of each tab key, matching the React contract. */
export function uniqueTableTabs<T extends TableTab>(tabs: readonly T[]): T[] {
  const seen = new Set<string>()
  return tabs.filter((tab) => {
    if (seen.has(tab.key)) return false
    seen.add(tab.key)
    return true
  })
}
