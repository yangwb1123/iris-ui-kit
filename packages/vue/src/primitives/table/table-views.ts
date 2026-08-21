import { computed, h, ref, type Ref, type VNode } from 'vue'
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
  sort: Readonly<Ref<IrisTableSortState | null>>
  setSort: (sort: IrisTableSortState | null) => void
  onActiveViewChange: (key: string | null) => void
}): {
  activeKey: Readonly<Ref<string | null>>
  views: Readonly<Ref<NamedView[]>>
  saveOpen: Ref<boolean>
  draft: Ref<string>
  renderTabs: (tabs: readonly TableTab[] | undefined) => VNode | null
  renderViews: () => VNode | null
} {
  const views = ref<NamedView[]>(readTableViews(options.config()))
  const internalActiveKey = ref<string | null>(null)
  const activeKey = computed<string | null>(() => {
    const config = options.config()
    return config?.activeKey !== undefined ? (config.activeKey ?? null) : internalActiveKey.value
  })
  const saveOpen = ref(false)
  const draft = ref('')
  const activeTab = ref<string | null>(null)
  const persist = (next: NamedView[]): void => {
    views.value = next
    writeTableViews(options.config(), next)
  }
  const applySnapshot = (snapshot: IrisTableViewSnapshot): void => {
    if (Object.prototype.hasOwnProperty.call(snapshot, 'sort'))
      options.setSort(snapshot.sort ?? null)
  }
  const select = (key: string): void => {
    const view = views.value.find((candidate) => candidate.name === key)
    if (!view) return
    applySnapshot(view.snapshot)
    internalActiveKey.value = key
    options.onActiveViewChange(key)
  }
  const save = (name: string): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const currentSort = options.sort.value
    const entry: NamedView = {
      name: trimmed,
      snapshot: { sort: currentSort ? { ...currentSort } : null },
    }
    const index = views.value.findIndex((view) => view.name === trimmed)
    persist(
      index < 0
        ? [...views.value, entry]
        : views.value.map((view, i) => (i === index ? entry : view)),
    )
    internalActiveKey.value = trimmed
    options.onActiveViewChange(trimmed)
  }
  const remove = (key: string): void => {
    persist(views.value.filter((view) => view.name !== key))
    if (activeKey.value === key) {
      internalActiveKey.value = null
      options.onActiveViewChange(null)
    }
  }
  const applyTab = (tab: TableTab): void => {
    activeTab.value = tab.key
    for (const name of tab.views ?? []) select(name)
  }
  return {
    activeKey,
    views,
    saveOpen,
    draft,
    renderTabs: (tabs) => renderTableTabs(tabs, activeTab, applyTab),
    renderViews: () =>
      renderTableViews({
        config: options.config(),
        views,
        activeKey,
        saveOpen,
        draft,
        onSelect: select,
        onSave: save,
        onDelete: remove,
      }),
  }
}

export interface TableViewsRenderContext {
  config: TableViewConfig | undefined
  views: Readonly<Ref<NamedView[]>>
  activeKey: Readonly<Ref<string | null>>
  saveOpen: Ref<boolean>
  draft: Ref<string>
  onSelect: (key: string) => void
  onSave: (name: string) => void
  onDelete: (key: string) => void
}

export function renderTableViews(ctx: TableViewsRenderContext): VNode | null {
  if (!ctx.config) return null
  return h(
    'div',
    {
      'data-iris-table-views-bar': '',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-space-xxs, 4px)',
        padding: 'var(--iris-space-xxs, 4px) 0',
      },
    },
    [
      h(
        'select',
        {
          'data-iris-table-views': '',
          value: ctx.saveOpen.value ? TABLE_VIEWS_SAVE_ITEM : (ctx.activeKey.value ?? ''),
          'aria-label': 'Table views',
          onChange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value
            if (value === TABLE_VIEWS_SAVE_ITEM) {
              ctx.draft.value = ''
              ctx.saveOpen.value = true
            } else if (value !== '') {
              ctx.onSelect(value)
            }
          },
          style: {
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            background: 'var(--iris-surface)',
            color: 'var(--iris-foreground)',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: '0 var(--iris-space-xxs, 4px)',
            maxWidth: '180px',
          },
        },
        [
          ctx.activeKey.value === null && !ctx.saveOpen.value
            ? h('option', { value: '', disabled: true }, 'Select view')
            : null,
          ...ctx.views.value.map((view) =>
            h(
              'option',
              { key: view.name, value: view.name },
              ctx.config?.label?.(view.name) ?? view.name,
            ),
          ),
          h('option', { value: TABLE_VIEWS_SAVE_ITEM }, '＋ Save view'),
        ],
      ),
      ctx.saveOpen.value
        ? h('input', {
            'data-iris-views-save': '',
            type: 'text',
            value: ctx.draft.value,
            placeholder: 'View name',
            'aria-label': 'Save view',
            onInput: (event: Event) => {
              ctx.draft.value = (event.target as HTMLInputElement).value
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (ctx.draft.value.trim()) ctx.onSave(ctx.draft.value)
                ctx.saveOpen.value = false
              } else if (event.key === 'Escape') {
                ctx.saveOpen.value = false
              }
            },
            onBlur: () => {
              ctx.saveOpen.value = false
            },
            style: {
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              padding: 'var(--iris-space-xxs, 4px)',
              width: '120px',
              font: 'inherit',
            },
          })
        : null,
      ctx.activeKey.value !== null
        ? h(
            'button',
            {
              type: 'button',
              'data-iris-table-views-delete': '',
              'aria-label': 'Delete view',
              onClick: () => ctx.onDelete(ctx.activeKey.value!),
              style: {
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--iris-muted)',
                font: 'inherit',
                padding: '0 var(--iris-space-xxs, 4px)',
              },
            },
            '×',
          )
        : null,
    ],
  )
}

export function renderTableTabs(
  tabs: readonly TableTab[] | undefined,
  activeTab: Readonly<Ref<string | null>>,
  onApply: (tab: TableTab) => void,
): VNode | null {
  const unique = uniqueTableTabs(tabs ?? [])
  if (unique.length === 0) return null
  return h(
    'div',
    {
      role: 'tablist',
      'data-iris-table-tabs': '',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-space-xs, 8px)',
        padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
        border: '1px solid var(--iris-border)',
        borderBottom: 'none',
        borderTopLeftRadius: 'var(--iris-radius-md, 6px)',
        borderTopRightRadius: 'var(--iris-radius-md, 6px)',
        background: 'var(--iris-surface)',
      },
    },
    unique.map((tab) =>
      h(
        'button',
        {
          key: tab.key,
          type: 'button',
          role: 'tab',
          'data-iris-table-tab': tab.key,
          'aria-selected': activeTab.value === tab.key ? 'true' : 'false',
          onClick: () => onApply(tab),
          style: {
            border: 'none',
            background: 'transparent',
            color: activeTab.value === tab.key ? 'var(--iris-primary)' : 'var(--iris-foreground)',
            cursor: 'pointer',
            font: 'inherit',
            fontWeight: activeTab.value === tab.key ? '600' : '400',
            padding: '0 var(--iris-space-xxs, 4px)',
          },
        },
        tab.label,
      ),
    ),
  )
}
