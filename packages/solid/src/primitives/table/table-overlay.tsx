import { createEffect, createSignal, For, onCleanup, Show, type Accessor, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { useDrag } from '../drag/useDrag'
import type {
  IrisTableColumn,
  IrisTableContextMenuItem,
  IrisTableContextMenuParams,
  IrisTableFilterOption,
} from './types'

/** Floating right-click menu for the table. */
export function TableContextMenu<Row extends Record<string, unknown>>(props: {
  open: boolean
  anchor: Accessor<HTMLElement | null>
  items: IrisTableContextMenuItem[]
  params: IrisTableContextMenuParams<Row>
  onSelect: (key: string, params: IrisTableContextMenuParams<Row>) => void
  onClose: () => void
}): JSX.Element {
  const [menuEl, setMenuEl] = createSignal<HTMLDivElement | null>(null)
  const { floatingStyles } = useFloating({
    anchor: props.anchor,
    floating: menuEl,
    open: () => props.open,
    placement: 'bottom-start',
    flip: false,
    shift: false,
  })
  useDismiss({ enabled: () => props.open, exclude: [menuEl], onDismiss: props.onClose })
  createEffect(() => {
    if (!props.open || typeof document === 'undefined') return
    const onScroll = (): void => props.onClose()
    document.addEventListener('scroll', onScroll, true)
    onCleanup(() => document.removeEventListener('scroll', onScroll, true))
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={setMenuEl}
          role="menu"
          data-iris-table-context-menu=""
          style={{
            ...floatingStyles(),
            'z-index': 'var(--iris-z-popover, 1000)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': 'var(--iris-shadow-lg)',
            padding: 'var(--iris-padding-sm, 4px)',
            'min-width': '160px',
            display: 'flex',
            'flex-direction': 'column',
          }}
        >
          <For each={props.items}>
            {(item) => (
              <button
                type="button"
                role="menuitem"
                data-iris-table-context-menu-item={item.key}
                disabled={item.disabled}
                aria-disabled={item.disabled ? 'true' : undefined}
                onClick={() => {
                  props.onSelect(item.key, props.params)
                  props.onClose()
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: item.disabled ? 'default' : 'pointer',
                  color: item.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                  font: 'inherit',
                  'text-align': 'start',
                  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </Portal>
    </Show>
  )
}

/** Header filter panel with local draft/confirm semantics. */
export function TableFilterPanel(props: {
  open: boolean
  anchor: Accessor<HTMLButtonElement | null>
  columnKey: string
  options: IrisTableFilterOption[]
  initialChecked: string[]
  onApply: (columnKey: string, values: string[]) => void
  onClear: (columnKey: string) => void
  onClose: () => void
  t: (key: string) => string
}): JSX.Element {
  const [panelEl, setPanelEl] = createSignal<HTMLDivElement | null>(null)
  const [checked, setChecked] = createSignal<string[]>(props.initialChecked)
  const { floatingStyles } = useFloating({
    anchor: props.anchor,
    floating: panelEl,
    open: () => props.open,
    placement: 'bottom-start',
  })
  useDismiss({
    enabled: () => props.open,
    exclude: [panelEl, props.anchor],
    onDismiss: props.onClose,
  })
  createEffect(() => {
    if (!props.open || typeof document === 'undefined') return
    const onScroll = (): void => props.onClose()
    document.addEventListener('scroll', onScroll, true)
    onCleanup(() => document.removeEventListener('scroll', onScroll, true))
  })
  const toggle = (value: string): void => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={setPanelEl}
          role="dialog"
          aria-label={props.t('table.filter')}
          data-iris-table-filter-panel=""
          data-iris-table-filter-column={props.columnKey}
          style={{
            ...floatingStyles(),
            'z-index': 'var(--iris-z-popover, 1000)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            'box-shadow': 'var(--iris-shadow-lg)',
            padding: 'var(--iris-space-sm, 12px)',
            'min-width': '180px',
            display: 'flex',
            'flex-direction': 'column',
            gap: 'var(--iris-space-xxs, 4px)',
          }}
        >
          <For each={props.options}>
            {(opt) => (
              <div
                data-iris-filter-option={opt.value}
                style={{ display: 'flex', 'align-items': 'center' }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    'align-items': 'center',
                    gap: 'var(--iris-space-xxs, 4px)',
                    cursor: 'pointer',
                    'font-size': 'var(--iris-font-size-sm, 13px)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked().includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                  />
                  {opt.label}
                </label>
              </div>
            )}
          </For>
          <div
            style={{
              display: 'flex',
              'justify-content': 'flex-end',
              gap: 'var(--iris-space-xs, 8px)',
              'margin-top': 'var(--iris-space-xs, 8px)',
            }}
          >
            <button
              type="button"
              data-iris-filter-clear=""
              onClick={() => {
                props.onClear(props.columnKey)
                props.onClose()
              }}
              style={{
                border: '1px solid var(--iris-border)',
                background: 'transparent',
                color: 'var(--iris-foreground)',
                cursor: 'pointer',
                font: 'inherit',
                'font-size': 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
              }}
            >
              {props.t('table.filterClear')}
            </button>
            <button
              type="button"
              data-iris-filter-confirm=""
              onClick={() => {
                props.onApply(props.columnKey, checked())
                props.onClose()
              }}
              style={{
                border: '1px solid var(--iris-primary)',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                cursor: 'pointer',
                font: 'inherit',
                'font-size': 'var(--iris-font-size-sm, 13px)',
                padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
                'border-radius': 'var(--iris-radius-sm, 4px)',
              }}
            >
              {props.t('table.filterConfirm')}
            </button>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

/** Focusable and draggable column resize grip. */
export function ColumnResizeHandle(props: {
  colKey: string
  label: string
  width: () => number
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
}): JSX.Element {
  const [handle, setHandle] = createSignal<HTMLElement | null>(null)
  let startWidth = 0
  const clamp = (width: number): number =>
    Math.max(props.minWidth, Math.min(props.maxWidth, Math.round(width)))
  useDrag({
    handle,
    onStart: () => {
      startWidth = props.width()
    },
    onDrag: ({ dx }) => props.onResize(props.colKey, clamp(startWidth + dx)),
  })
  return (
    <span
      ref={setHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${props.label}`}
      tabindex={0}
      data-iris-table-resize-handle=""
      data-column-key={props.colKey}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          event.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() - 16))
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          event.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() + 16))
        }
      }}
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        width: '8px',
        cursor: 'col-resize',
        'touch-action': 'none',
        'user-select': 'none',
      }}
    />
  )
}

export function resolveInitialWidth<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
): number {
  if (typeof col.width === 'number') return col.width
  if (typeof col.width === 'string') {
    const match = col.width.match(/^(\d+(?:\.\d+)?)px$/)
    if (match) return Number(match[1])
  }
  return 140
}
