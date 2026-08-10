import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { useDismiss } from '../../floating/useDismiss'
import { IrisCheckbox } from '../checkbox/Checkbox'
import type { IrisTableFilterOption } from './types'

interface TableFilterPanelProps {
  open: boolean
  /**
   * The header trigger button — a REAL DOM node, so it doubles as the floating
   * anchor directly (no virtual anchor needed, unlike the context menu).
   */
  anchorRef: React.RefObject<HTMLButtonElement | null>
  columnKey: string
  options: IrisTableFilterOption[]
  /** Checked values when the panel opened (seeded once; draft semantics). */
  initialChecked: string[]
  /** Confirm writes the draft (and closes). */
  onApply: (columnKey: string, values: string[]) => void
  /** Clear applies an empty set immediately (and closes). */
  onClear: (columnKey: string) => void
  onClose: () => void
  t: (key: string) => string
}

/**
 * Header filter panel for `IrisTable` (vxe-grid filterConfig parity, batch I).
 * Self-drawn with the same building blocks `IrisMenuContent` uses —
 * `useFloating` + `useDismiss` — because it floats below the header trigger
 * button rather than being owned by a trigger-primitive.
 *
 * Positioning: anchored to the real trigger button (`placement: bottom-start`).
 * Dismissal: Escape, outside pointer-down (useDismiss), and any scroll
 * (capture-phase document listener — nested scrollers count too). Rendered
 * through a portal to `document.body` so the table's `overflow` clipping never
 * cuts it.
 *
 * Draft semantics: checking options edits a local draft; 确认 (confirm) writes
 * it through `onApply`, 清除 (clear) writes an empty set through `onClear`
 * immediately, and any dismissal discards the draft.
 */
export function TableFilterPanel({
  open,
  anchorRef,
  columnKey,
  options,
  initialChecked,
  onApply,
  onClear,
  onClose,
  t,
}: TableFilterPanelProps): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [checked, setChecked] = React.useState<string[]>(initialChecked)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-start',
  })

  useDismiss({
    enabled: open,
    exclude: [panelRef, anchorRef],
    onDismiss: onClose,
  })

  // Scroll anywhere closes the panel. Capture phase so scrolling inside any
  // nested scroll container (or the table itself) also counts.
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onScroll = (): void => onCloseRef.current()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [open])

  const toggle = (value: string): void => {
    setChecked((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.filter')}
      data-iris-table-filter-panel=""
      data-iris-table-filter-column={columnKey}
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xxs, 4px)',
      }}
    >
      {options.map((opt) => (
        <div
          key={opt.value}
          data-iris-filter-option={opt.value}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <IrisCheckbox
            checked={checked.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            size="sm"
          >
            {opt.label}
          </IrisCheckbox>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--iris-space-xs, 8px)',
          marginTop: 'var(--iris-space-xs, 8px)',
        }}
      >
        <button
          type="button"
          data-iris-filter-clear=""
          onClick={() => {
            onClear(columnKey)
            onClose()
          }}
          style={{
            border: '1px solid var(--iris-border)',
            background: 'transparent',
            color: 'var(--iris-foreground)',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          }}
        >
          {t('table.filterClear')}
        </button>
        <button
          type="button"
          data-iris-filter-confirm=""
          onClick={() => {
            onApply(columnKey, checked)
            onClose()
          }}
          style={{
            border: '1px solid var(--iris-primary)',
            background: 'var(--iris-primary)',
            color: 'var(--iris-primary-foreground, #fff)',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
          }}
        >
          {t('table.filterConfirm')}
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
