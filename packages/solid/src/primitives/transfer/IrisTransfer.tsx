import { createSignal, createMemo, mergeProps, splitProps, Show, For, type JSX } from 'solid-js'
import { createSelectionModel } from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'
import { IrisVirtualScroll } from '../virtual-scroll/IrisVirtualScroll'

export interface IrisTransferItem {
  label: string
  value: string
  disabled?: boolean
}

/** Opt-in windowed rendering of a pane's list (mirrors `IrisTableVirtualOptions`). */
export interface IrisTransferVirtualOptions {
  /** Per-item height in px (uniform). */
  itemHeight: number
  /**
   * Viewport height. Number → px; string → CSS length. Defaults to the pane's
   * intrinsic list height (200px).
   */
  height?: number | string
  /** Extra rows rendered above and below the viewport. */
  buffer?: number
}

export interface IrisTransferProps {
  options?: IrisTransferItem[]
  value?: string[]
  defaultValue?: string[]
  titles?: [string, string]
  searchable?: boolean
  disabled?: boolean
  /**
   * Opt-in windowed rendering of both pane lists via the core virtualizer
   * (10k+ options stay smooth). Off by default — the plain path is unchanged.
   */
  virtual?: IrisTransferVirtualOptions
  onChange?: (values: string[]) => void
}

/**
 * Dual-list transfer: move items between available and selected panes.
 * Solid port of the Vue IrisTransfer.
 */
export function IrisTransfer(props: IrisTransferProps): JSX.Element {
  const { t } = useI18n()
  const merged = mergeProps(
    {
      options: [] as IrisTransferItem[],
      defaultValue: [] as string[],
      searchable: false,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'options',
    'value',
    'defaultValue',
    'titles',
    'searchable',
    'disabled',
    'virtual',
    'onChange',
  ])

  const [internalValue, setInternalValue] = createSignal<string[]>(local.defaultValue)
  // The two panes' checked sets are single-sourced in core selection models
  // (multiple mode, internal/uncontrolled) instead of hand-rolled Set state.
  const sourceModel = createSelectionModel<string>({ mode: 'multiple' })
  const targetModel = createSelectionModel<string>({ mode: 'multiple' })
  const sourceChecked = useStore(sourceModel.store)
  const targetChecked = useStore(targetModel.store)
  const [sourceQuery, setSourceQuery] = createSignal('')
  const [targetQuery, setTargetQuery] = createSignal('')

  const currentValue = (): string[] => local.value ?? internalValue()
  const valueSet = createMemo(() => new Set(currentValue()))

  const sourceItems = createMemo(() =>
    local.options.filter(
      (o) =>
        !valueSet().has(o.value) &&
        (!sourceQuery() || o.label.toLowerCase().includes(sourceQuery().toLowerCase())),
    ),
  )
  const targetItems = createMemo(() =>
    local.options.filter(
      (o) =>
        valueSet().has(o.value) &&
        (!targetQuery() || o.label.toLowerCase().includes(targetQuery().toLowerCase())),
    ),
  )

  const emitChange = (next: string[]) => {
    if (!local.value) setInternalValue(next)
    local.onChange?.(next)
  }

  const moveToTarget = () => {
    if (local.disabled) return
    const moving = sourceItems().filter((o) => !o.disabled && sourceModel.isSelected(o.value))
    if (moving.length === 0) return
    emitChange([...currentValue(), ...moving.map((o) => o.value)])
    sourceModel.clear()
  }

  const moveToSource = () => {
    if (local.disabled) return
    const removing = new Set(
      targetItems()
        .filter((o) => !o.disabled && targetModel.isSelected(o.value))
        .map((o) => o.value),
    )
    emitChange(currentValue().filter((v) => !removing.has(v)))
    targetModel.clear()
  }

  const toggleCheck = (side: 'source' | 'target', value: string): void => {
    const m = side === 'source' ? sourceModel : targetModel
    m.toggle(value)
  }

  // Select-all per pane: check every eligible item, or clear if all already
  // checked (mirrors React/Vue/Svelte).
  const eligibleValues = (side: 'source' | 'target'): string[] =>
    (side === 'source' ? sourceItems() : targetItems())
      .filter((o) => !o.disabled && !local.disabled)
      .map((o) => o.value)

  const allChecked = (side: 'source' | 'target'): boolean => {
    const m = side === 'source' ? sourceModel : targetModel
    const eligible = eligibleValues(side)
    return eligible.length > 0 && eligible.every((v) => m.isSelected(v))
  }

  const toggleAll = (side: 'source' | 'target'): void => {
    const m = side === 'source' ? sourceModel : targetModel
    if (allChecked(side)) m.clear()
    else m.set(eligibleValues(side))
  }

  const panelStyle: JSX.CSSProperties = {
    flex: '1',
    border: '1px solid var(--iris-border)',
    'border-radius': 'var(--iris-radius-md, 6px)',
    overflow: 'hidden',
    display: 'flex',
    'flex-direction': 'column',
    background: 'var(--iris-surface)',
    'min-width': '160px',
  }

  // Shared row renderer: `<li>` in the plain ul, `<div>` inside the virtual
  // scroller's div wrapper (an `li` there would be invalid HTML).
  const renderRow = (
    item: IrisTransferItem,
    Tag: 'li' | 'div',
    side: 'source' | 'target',
    checked: () => string[],
  ) => {
    const inner = (
      <>
        <input
          type="checkbox"
          checked={checked().includes(item.value)}
          disabled={item.disabled || local.disabled || undefined}
          onChange={() => {
            if (!item.disabled && !local.disabled) toggleCheck(side, item.value)
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          style={{
            'font-size': 'var(--iris-font-size-md, 14px)',
            color: 'var(--iris-foreground)',
          }}
        >
          {item.label}
        </span>
      </>
    )
    const rowStyle: JSX.CSSProperties = {
      display: 'flex',
      'align-items': 'center',
      gap: '8px',
      padding: 'var(--iris-padding-sm, 6px) var(--iris-space-xs, 8px)',
      'border-radius': 'var(--iris-radius-sm, 4px)',
      cursor: item.disabled || local.disabled ? 'not-allowed' : 'pointer',
      opacity: item.disabled ? '0.5' : '1',
    }
    // Solid compiles dynamic string tags to createComponent, so the wrapper is
    // spelled out for both tags — identical props, `<li>` vs `<div>` only.
    return Tag === 'li' ? (
      <li
        role="option"
        aria-selected={checked().includes(item.value)}
        data-iris-transfer-item={`${side}-${item.value}`}
        style={rowStyle}
        onClick={() => {
          if (item.disabled || local.disabled) return
          toggleCheck(side, item.value)
        }}
      >
        {inner}
      </li>
    ) : (
      <div
        role="option"
        aria-selected={checked().includes(item.value)}
        data-iris-transfer-item={`${side}-${item.value}`}
        style={rowStyle}
        onClick={() => {
          if (item.disabled || local.disabled) return
          toggleCheck(side, item.value)
        }}
      >
        {inner}
      </div>
    )
  }
  const listStyle: JSX.CSSProperties = {
    'list-style': 'none',
    margin: '0',
    padding: '4px',
    flex: '1',
    'overflow-y': 'auto',
    'max-height': '200px',
  }
  const virtualHeight = (): number | string => local.virtual?.height ?? 200
  // CSS-length form of the pane height for the scroller's `max-height` (a
  // number is px; strings pass through).
  const virtualHeightCss = (): string => {
    const v = virtualHeight()
    return typeof v === 'number' ? `${v}px` : v
  }

  const renderPanel = (
    side: 'source' | 'target',
    items: () => IrisTransferItem[],
    checked: () => string[],
    title: string,
    query: () => string,
    setQuery: (v: string) => void,
  ) => (
    <div data-iris-transfer-panel={side} style={panelStyle}>
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '8px 12px',
          'border-bottom': '1px solid var(--iris-border)',
          'font-size': 'var(--iris-font-size-sm, 13px)',
          'font-weight': '600',
          color: 'var(--iris-foreground)',
        }}
      >
        <input
          type="checkbox"
          aria-label={t(
            side === 'source' ? 'transfer.selectAllSource' : 'transfer.selectAllTarget',
          )}
          checked={allChecked(side)}
          disabled={local.disabled || undefined}
          onChange={() => toggleAll(side)}
        />
        <span>{title}</span>
        <span
          style={{ 'margin-left': 'auto', 'font-weight': 'normal', color: 'var(--iris-muted)' }}
        >
          {checked().length}/{items().length}
        </span>
      </div>
      <Show when={local.searchable}>
        <div
          style={{
            padding: 'var(--iris-padding-sm, 6px) var(--iris-space-xs, 8px)',
            'border-bottom': '1px solid var(--iris-border)',
          }}
        >
          <input
            type="text"
            placeholder={t('transfer.search')}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-sm, 4px)',
              'font-size': 'var(--iris-font-size-sm, 13px)',
              color: 'var(--iris-foreground)',
              'box-sizing': 'border-box',
              outline: 'none',
            }}
          />
        </div>
      </Show>
      <Show
        when={local.virtual && items().length > 0}
        fallback={
          <ul role="listbox" aria-multiselectable="true" style={listStyle}>
            <For each={items()}>{(item) => renderRow(item, 'li', side, checked)}</For>
          </ul>
        }
      >
        <IrisVirtualScroll
          items={items()}
          itemHeight={local.virtual!.itemHeight}
          height={virtualHeight()}
          buffer={local.virtual!.buffer}
          keyOf={(o) => o.value}
          role="listbox"
          aria-multiselectable={true}
          style={{
            flex: '1',
            'max-height': virtualHeightCss(),
            'box-sizing': 'content-box',
          }}
          renderItem={(item) => renderRow(item, 'div', side, checked)}
        />
      </Show>
    </div>
  )

  const btnStyle: JSX.CSSProperties = {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '28px',
    height: '28px',
    padding: '0',
    background: 'var(--iris-primary)',
    color: 'var(--iris-primary-foreground, #fff)',
    border: 'none',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    cursor: 'pointer',
    'font-size': 'var(--iris-font-size-md, 14px)',
  }

  return (
    <div
      data-iris-transfer=""
      data-disabled={local.disabled ? '' : undefined}
      style={{ display: 'flex', gap: '12px', 'align-items': 'stretch' }}
    >
      {renderPanel(
        'source',
        sourceItems,
        sourceChecked,
        local.titles?.[0] ?? t('transfer.sourceTitle'),
        sourceQuery,
        setSourceQuery,
      )}

      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '8px',
        }}
      >
        <button
          type="button"
          data-iris-transfer-move-right=""
          disabled={local.disabled || sourceChecked().length === 0 || undefined}
          onClick={moveToTarget}
          aria-label={t('transfer.toTarget')}
          style={{ ...btnStyle, opacity: sourceChecked().length === 0 ? '0.4' : '1' }}
        >
          ›
        </button>
        <button
          type="button"
          data-iris-transfer-move-left=""
          disabled={local.disabled || targetChecked().length === 0 || undefined}
          onClick={moveToSource}
          aria-label={t('transfer.toSource')}
          style={{ ...btnStyle, opacity: targetChecked().length === 0 ? '0.4' : '1' }}
        >
          ‹
        </button>
      </div>

      {renderPanel(
        'target',
        targetItems,
        targetChecked,
        local.titles?.[1] ?? t('transfer.targetTitle'),
        targetQuery,
        setTargetQuery,
      )}
    </div>
  )
}
