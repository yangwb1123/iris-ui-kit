import { h, Teleport, type Ref, type VNode } from 'vue'
import { IrisCheckbox } from '../checkbox/Checkbox'
import type { UseI18nReturn } from '../../i18n'
import type {
  IrisTableColumn,
  IrisTableContextMenuConfig,
  IrisTableContextMenuParams,
  IrisTableFilterValues,
} from './types'

type TableRow = Record<string, unknown>
type Translate = UseI18nReturn['t']
export interface ContextMenuState {
  open: boolean
  items: Array<{ key: string; label: string; disabled?: boolean }>
  params: IrisTableContextMenuParams<TableRow>
}

export interface ContextMenuSectionContext {
  state: Readonly<Ref<ContextMenuState | null>>
  styles: Readonly<Ref<Record<string, string>>>
  menuRef: Ref<HTMLElement | null>
  close: () => void
  contextMenu: IrisTableContextMenuConfig<TableRow> | undefined
}

/** Render the teleported right-click menu. */
export function renderContextMenuSection(ctx: ContextMenuSectionContext): VNode | null {
  const st = ctx.state.value
  if (!st || !st.open) return null
  const node = h(
    'div',
    {
      ref: (el: unknown) => {
        ctx.menuRef.value = (el ?? null) as HTMLElement | null
      },
      role: 'menu',
      'data-iris-table-context-menu': '',
      style: {
        ...ctx.styles.value,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-xxs, 4px)',
        minWidth: '160px',
        display: 'flex',
        flexDirection: 'column',
      },
    },
    st.items.map((item) =>
      h(
        'button',
        {
          key: item.key,
          type: 'button',
          role: 'menuitem',
          'data-iris-table-context-menu-item': item.key,
          disabled: item.disabled,
          'aria-disabled': item.disabled ? 'true' : undefined,
          onClick: () => {
            ctx.contextMenu!.onSelect(item.key, st.params)
            ctx.close()
          },
          style: {
            border: 'none',
            background: 'transparent',
            cursor: item.disabled ? 'default' : 'pointer',
            color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
            font: 'inherit',
            textAlign: 'start',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          },
        },
        item.label,
      ),
    ),
  )
  return h(Teleport, { to: 'body' }, [node])
}

export interface FilterPanelState {
  open: boolean
  colKey: string
}

export interface FilterPanelSectionContext {
  state: Readonly<Ref<FilterPanelState | null>>
  styles: Readonly<Ref<Record<string, string>>>
  panelRef: Ref<HTMLElement | null>
  filterDraft: Readonly<Ref<string[]>>
  columns: IrisTableColumn<TableRow>[]
  filterValues: IrisTableFilterValues | undefined
  t: Translate
  close: () => void
  toggle: (value: string) => void
  apply: (colKey: string, values: string[]) => void
  clear: (colKey: string) => void
}

/** Render the teleported checkbox filter panel for one header column. */
export function renderFilterPanelSection(ctx: FilterPanelSectionContext): VNode | null {
  const st = ctx.state.value
  if (!st || !st.open) return null
  const col = ctx.columns.find((c) => c.key === st.colKey)
  if (!col || !col.filterable) return null
  const options = col.filterOptions ?? []
  const node = h(
    'div',
    {
      ref: (el: unknown) => {
        ctx.panelRef.value = (el ?? null) as HTMLElement | null
      },
      role: 'dialog',
      'aria-label': ctx.t('table.filter'),
      'data-iris-table-filter-panel': '',
      'data-iris-table-filter-column': st.colKey,
      style: {
        ...ctx.styles.value,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xxs, 4px)',
      },
    },
    [
      ...options.map((opt) =>
        h(
          'div',
          {
            key: opt.value,
            'data-iris-filter-option': opt.value,
            style: { display: 'flex', alignItems: 'center' },
          },
          [
            h(
              IrisCheckbox,
              {
                modelValue: ctx.filterDraft.value.includes(opt.value),
                size: 'sm',
                'onUpdate:modelValue': () => ctx.toggle(opt.value),
              },
              { default: () => opt.label },
            ),
          ],
        ),
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--iris-space-xs, 8px)',
            marginTop: 'var(--iris-space-xs, 8px)',
          },
        },
        [
          h(
            'button',
            {
              type: 'button',
              'data-iris-filter-clear': '',
              onClick: () => {
                ctx.clear(st.colKey)
                ctx.close()
              },
              style: {
                border: '1px solid var(--iris-border)',
                background: 'transparent',
                color: 'var(--iris-foreground)',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
              },
            },
            ctx.t('table.filterClear'),
          ),
          h(
            'button',
            {
              type: 'button',
              'data-iris-filter-confirm': '',
              onClick: () => {
                ctx.apply(st.colKey, ctx.filterDraft.value)
                ctx.close()
              },
              style: {
                border: '1px solid var(--iris-primary)',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
              },
            },
            ctx.t('table.filterConfirm'),
          ),
        ],
      ),
    ],
  )
  return h(Teleport, { to: 'body' }, [node])
}
