import * as React from 'react'
import { createSelectionModel, type SelectionModel } from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import { useI18n } from '../../i18n'

export interface IrisTransferItem {
  label: string
  value: string
  disabled?: boolean
}

export interface IrisTransferProps {
  options: IrisTransferItem[]
  /** Values currently in the target (selected) pane. */
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (values: string[]) => void
  /** Pane titles: [available, selected]. */
  titles?: [React.ReactNode, React.ReactNode]
  /** Show a search box per pane. */
  searchable?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
}

type Side = 'source' | 'target'

/**
 * Dual-list transfer: move items between an "available" and a "selected" pane
 * via per-item checkboxes and the ›/‹ buttons. Controlled or uncontrolled
 * (`value` = the selected values), with optional per-pane search and a
 * select-all header. Built on native checkboxes for accessibility.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisTransfer}.
 */
export function IrisTransfer({
  options,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  titles,
  searchable = false,
  disabled = false,
  style,
  className,
  ...rest
}: IrisTransferProps): React.ReactElement {
  const safeOptions = options ?? []
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<string[]>(defaultValue)
  const value = isControlled ? (valueProp as string[]) : internal
  const valueSet = new Set(value)

  // Each pane's tentative "checked" set is a multi-select set; the per-item
  // toggle + dedup is single-sourced in the core model (one per pane). These
  // sets are purely internal (never controlled). Select-all REPLACES the set
  // with the visible-enabled items (or clears it), so it uses `model.set`
  // rather than the model's add/remove `toggleAll`.
  const sourceModelRef = React.useRef<SelectionModel<string> | null>(null)
  if (sourceModelRef.current === null) {
    sourceModelRef.current = createSelectionModel<string>({ mode: 'multiple' })
  }
  const targetModelRef = React.useRef<SelectionModel<string> | null>(null)
  if (targetModelRef.current === null) {
    targetModelRef.current = createSelectionModel<string>({ mode: 'multiple' })
  }
  const sourceModel = sourceModelRef.current
  const targetModel = targetModelRef.current
  const sourceChecked = useStore(sourceModel.store)
  const targetChecked = useStore(targetModel.store)
  const [sourceQuery, setSourceQuery] = React.useState('')
  const [targetQuery, setTargetQuery] = React.useState('')

  const setValue = (next: string[]) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const sourceItems = safeOptions.filter((o) => !valueSet.has(o.value))
  const targetItems = safeOptions.filter((o) => valueSet.has(o.value))

  const moveToTarget = () => {
    if (disabled) return
    const moving = sourceItems.filter((o) => !o.disabled && sourceChecked.includes(o.value))
    if (moving.length === 0) return
    setValue([...value, ...moving.map((o) => o.value)])
    sourceModel.clear()
  }
  const moveToSource = () => {
    if (disabled) return
    const removing = new Set(
      targetItems.filter((o) => !o.disabled && targetChecked.includes(o.value)).map((o) => o.value),
    )
    if (removing.size === 0) return
    setValue(value.filter((v) => !removing.has(v)))
    targetModel.clear()
  }

  const paneStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: 220,
    border: '1px solid var(--iris-border)',
    borderRadius: 'var(--iris-radius-md, 6px)',
    background: 'var(--iris-background)',
    overflow: 'hidden',
  }
  const moveBtnStyle: React.CSSProperties = {
    width: 32,
    height: 28,
    border: '1px solid var(--iris-border)',
    borderRadius: 'var(--iris-radius-sm, 4px)',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    cursor: 'pointer',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    lineHeight: 1,
  }

  const renderPane = (side: Side) => {
    const items = side === 'source' ? sourceItems : targetItems
    const model = side === 'source' ? sourceModel : targetModel
    const checked = side === 'source' ? sourceChecked : targetChecked
    const query = side === 'source' ? sourceQuery : targetQuery
    const setQuery = side === 'source' ? setSourceQuery : setTargetQuery
    const visible = query
      ? items.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
      : items
    const selectable = visible.filter((o) => !o.disabled)
    const allChecked = selectable.length > 0 && selectable.every((o) => checked.includes(o.value))
    const someChecked = selectable.some((o) => checked.includes(o.value))
    const checkedCount = items.filter((o) => checked.includes(o.value)).length

    const toggle = (v: string) => model.toggle(v)
    const toggleAll = () => {
      model.set(allChecked ? [] : selectable.map((o) => o.value))
    }

    return (
      <div data-iris-transfer-pane="" data-side={side} style={paneStyle}>
        <div
          data-iris-transfer-header=""
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
            borderBlockEnd: '1px solid var(--iris-border)',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            fontWeight: 500,
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--iris-space-xs, 8px)',
              minWidth: 0,
            }}
          >
            <input
              type="checkbox"
              data-iris-transfer-select-all=""
              checked={allChecked}
              disabled={disabled || selectable.length === 0}
              ref={(el) => {
                if (el) el.indeterminate = someChecked && !allChecked
              }}
              onChange={toggleAll}
            />
            <span>{titles?.[side === 'source' ? 0 : 1]}</span>
          </label>
          <span
            data-iris-transfer-count=""
            style={{ color: 'var(--iris-muted)', fontSize: 'var(--iris-font-size-xs, 12px)' }}
          >
            {checkedCount}/{items.length}
          </span>
        </div>
        {searchable ? (
          <input
            type="search"
            data-iris-transfer-search=""
            aria-label={t('transfer.search')}
            placeholder={t('transfer.search')}
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              margin: 8,
              padding: '4px 8px',
              fontSize: 'var(--iris-font-size-sm, 13px)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background: 'var(--iris-background)',
              color: 'var(--iris-foreground)',
              outline: 'none',
            }}
          />
        ) : null}
        <ul
          data-iris-transfer-list=""
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 4,
            maxHeight: 200,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {visible.length === 0 ? (
            <li
              data-iris-transfer-empty=""
              style={{
                padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
                textAlign: 'center',
              }}
            >
              {t('transfer.empty')}
            </li>
          ) : (
            visible.map((o) => (
              <li key={o.value} data-iris-transfer-item="" data-value={o.value}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    opacity: o.disabled ? 0.5 : 1,
                    fontSize: 'var(--iris-font-size-md, 14px)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked.includes(o.value)}
                    disabled={disabled || o.disabled}
                    onChange={() => toggle(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
    )
  }

  const canToTarget =
    !disabled && sourceItems.some((o) => !o.disabled && sourceChecked.includes(o.value))
  const canToSource =
    !disabled && targetItems.some((o) => !o.disabled && targetChecked.includes(o.value))

  return (
    <div
      data-iris-transfer=""
      data-disabled={disabled ? 'true' : undefined}
      className={className}
      {...rest}
      style={{ display: 'inline-flex', alignItems: 'stretch', gap: 12, ...style }}
    >
      {renderPane('source')}
      <div
        data-iris-transfer-controls=""
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}
      >
        <button
          type="button"
          data-iris-transfer-to-target=""
          aria-label={t('transfer.toTarget')}
          disabled={!canToTarget}
          onClick={moveToTarget}
          style={moveBtnStyle}
        >
          ›
        </button>
        <button
          type="button"
          data-iris-transfer-to-source=""
          aria-label={t('transfer.toSource')}
          disabled={!canToSource}
          onClick={moveToSource}
          style={moveBtnStyle}
        >
          ‹
        </button>
      </div>
      {renderPane('target')}
    </div>
  )
}
