import { createSignal, For, Show, type Accessor, type JSX } from 'solid-js'
import {
  readTableViews,
  TABLE_VIEWS_SAVE_ITEM,
  uniqueTableTabs,
  writeTableViews,
  type TableNamedView,
  type TableTab,
  type TableViewConfig,
} from '@iris-ui-kit/core'
import type { IrisTableSortState, IrisTableViewSnapshot } from './types'

type NamedView = TableNamedView<IrisTableViewSnapshot>

export function createTableViewsController(options: {
  config: () => TableViewConfig | undefined
  sort: Accessor<IrisTableSortState | null>
  setSort: (sort: IrisTableSortState | null) => void
  onActiveViewChange: (key: string | null) => void
}): {
  viewList: Accessor<NamedView[]>
  activeViewKey: Accessor<string | null>
  activeTab: Accessor<string | null>
  selectView: (key: string) => void
  saveView: (name: string) => void
  deleteView: (key: string) => void
  applyTableTab: (tab: TableTab) => void
} {
  const [viewList, setViewList] = createSignal<NamedView[]>(readTableViews(options.config()))
  const [internalActiveView, setInternalActiveView] = createSignal<string | null>(null)
  const activeViewKey = (): string | null => {
    const key = options.config()?.activeKey
    return key !== undefined ? (key ?? null) : internalActiveView()
  }
  const [activeTab, setActiveTab] = createSignal<string | null>(null)
  const persist = (next: NamedView[]): void => {
    setViewList(next)
    writeTableViews(options.config(), next)
  }
  const applySnapshot = (snapshot: IrisTableViewSnapshot): void => {
    if (Object.prototype.hasOwnProperty.call(snapshot, 'sort'))
      options.setSort(snapshot.sort ?? null)
  }
  const selectView = (key: string): void => {
    const view = viewList().find((candidate) => candidate.name === key)
    if (!view) return
    applySnapshot(view.snapshot)
    setInternalActiveView(key)
    options.onActiveViewChange(key)
  }
  const saveView = (name: string): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const currentSort = options.sort()
    const entry: NamedView = {
      name: trimmed,
      snapshot: { sort: currentSort ? { ...currentSort } : null },
    }
    const previous = viewList()
    const index = previous.findIndex((view) => view.name === trimmed)
    persist(
      index < 0 ? [...previous, entry] : previous.map((view, i) => (i === index ? entry : view)),
    )
    setInternalActiveView(trimmed)
    options.onActiveViewChange(trimmed)
  }
  const deleteView = (key: string): void => {
    persist(viewList().filter((view) => view.name !== key))
    if (activeViewKey() === key) {
      setInternalActiveView(null)
      options.onActiveViewChange(null)
    }
  }
  const applyTableTab = (tab: TableTab): void => {
    setActiveTab(tab.key)
    for (const name of tab.views ?? []) selectView(name)
  }
  return { viewList, activeViewKey, activeTab, selectView, saveView, deleteView, applyTableTab }
}

export function TableViews(props: {
  config: TableViewConfig | undefined
  views: Accessor<NamedView[]>
  activeKey: Accessor<string | null>
  onSelect: (key: string) => void
  onSave: (name: string) => void
  onDelete: (key: string) => void
}): JSX.Element {
  const [saveOpen, setSaveOpen] = createSignal(false)
  const [draft, setDraft] = createSignal('')
  const openSave = (): void => {
    setDraft('')
    setSaveOpen(true)
  }
  const confirmSave = (): void => {
    if (draft().trim()) props.onSave(draft())
    setSaveOpen(false)
  }
  return (
    <Show when={props.config}>
      <div
        data-iris-table-views-bar=""
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: 'var(--iris-space-xxs, 4px)',
          padding: 'var(--iris-space-xxs, 4px) 0',
        }}
      >
        <select
          data-iris-table-views=""
          value={saveOpen() ? TABLE_VIEWS_SAVE_ITEM : (props.activeKey() ?? '')}
          aria-label="Table views"
          onChange={(event) => {
            const value = event.currentTarget.value
            if (value === TABLE_VIEWS_SAVE_ITEM) openSave()
            else if (value !== '') props.onSelect(value)
          }}
          style={{
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-sm, 4px)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            font: 'inherit',
            'font-size': 'var(--iris-font-size-sm, 13px)',
            padding: '0 var(--iris-space-xxs, 4px)',
            'max-width': '180px',
          }}
        >
          <Show when={props.activeKey() === null && !saveOpen()}>
            <option value="" disabled>
              Select view
            </option>
          </Show>
          <For each={props.views()}>
            {(view) => (
              <option value={view.name}>{props.config?.label?.(view.name) ?? view.name}</option>
            )}
          </For>
          <option value={TABLE_VIEWS_SAVE_ITEM}>＋ Save view</option>
        </select>
        <Show when={saveOpen()}>
          <input
            data-iris-views-save=""
            type="text"
            value={draft()}
            placeholder="View name"
            aria-label="Save view"
            onInput={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirmSave()
              } else if (event.key === 'Escape') {
                setSaveOpen(false)
              }
            }}
            onBlur={() => setSaveOpen(false)}
            style={{
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-sm, 4px)',
              padding: 'var(--iris-space-xxs, 4px)',
              width: '120px',
              font: 'inherit',
            }}
          />
        </Show>
        <Show when={props.activeKey() !== null}>
          <button
            type="button"
            data-iris-table-views-delete=""
            aria-label="Delete view"
            onClick={() => props.onDelete(props.activeKey()!)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--iris-muted)',
              font: 'inherit',
              padding: '0 var(--iris-space-xxs, 4px)',
            }}
          >
            ×
          </button>
        </Show>
      </div>
    </Show>
  )
}

export function TableTabs(props: {
  tabs: TableTab[] | undefined
  activeKey: Accessor<string | null>
  onApply: (tab: TableTab) => void
}): JSX.Element {
  const tabs = (): TableTab[] => uniqueTableTabs(props.tabs ?? [])
  return (
    <Show when={tabs().length > 0}>
      <div
        role="tablist"
        data-iris-table-tabs=""
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: 'var(--iris-space-xs, 8px)',
          padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
          border: '1px solid var(--iris-border)',
          'border-bottom': 'none',
          'border-top-left-radius': 'var(--iris-radius-md, 6px)',
          'border-top-right-radius': 'var(--iris-radius-md, 6px)',
          background: 'var(--iris-surface)',
        }}
      >
        <For each={tabs()}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              data-iris-table-tab={tab.key}
              aria-selected={props.activeKey() === tab.key ? 'true' : 'false'}
              onClick={() => props.onApply(tab)}
              style={{
                border: 'none',
                background: 'transparent',
                color:
                  props.activeKey() === tab.key ? 'var(--iris-primary)' : 'var(--iris-foreground)',
                cursor: 'pointer',
                font: 'inherit',
                'font-weight': props.activeKey() === tab.key ? '600' : '400',
                padding: '0 var(--iris-space-xxs, 4px)',
              }}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}
