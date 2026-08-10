import * as React from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'
import { useBodyScrollLock } from '../../modal-utils/useBodyScrollLock'
import { useFocusTrap } from '../../modal-utils/useFocusTrap'
import { IrisVirtualScroll, type IrisVirtualScrollHandle } from '../virtual-scroll/VirtualScroll'
import { defaultFilter, type IrisCommandItem } from './types'

export interface IrisCommandPaletteProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  items: IrisCommandItem[]
  placeholder?: string
  /** Empty state text when no item matches. */
  emptyText?: string
  /** Custom filter; default is a tolerant subsequence/fuzzy match. */
  filter?: (query: string, item: IrisCommandItem) => number | null
  onSelect?: (item: IrisCommandItem) => void
  /**
   * Opt-in windowed rendering of the results list via the core virtualizer.
   * When true, only the visible window (+ buffer) of rows is rendered and
   * keyboard navigation scrolls the active row into view. Default false —
   * the plain list renders bit-for-bit as before.
   */
  virtual?: boolean
}

type Row = { kind: 'header'; label: string } | { kind: 'item'; item: IrisCommandItem }

// Fixed per-row heights (px) — MUST track the row style blocks below:
// header = 12px font × ~1.4 line-height + 2×6px padding ≈ 28px;
// item = 14px font × ~1.4 + 2×8px padding ≈ 36px. Rows are single-line, so
// these are exact and content-independent.
const COMMAND_HEADER_HEIGHT = 28
const COMMAND_ITEM_HEIGHT = 36
/** Extra rows rendered above/below the viewport (matches Combobox/Cascader). */
const COMMAND_VIRTUAL_BUFFER = 4

/**
 * Command palette: searchable, keyboard-driven action launcher. Built on the
 * modal-utils suite (scroll lock + focus trap). Pattern: open via shortcut
 * (consumer wires the listener), type to filter, ↑/↓ to navigate, Enter to
 * execute the focused item, Escape to dismiss.
 */
export function IrisCommandPalette({
  open = false,
  onOpenChange,
  items,
  placeholder,
  emptyText,
  filter = defaultFilter,
  onSelect,
  virtual = false,
  style,
  ...rest
}: IrisCommandPaletteProps): React.ReactElement | null {
  const { t } = useI18n()
  const resolvedPlaceholder = placeholder ?? t('commandPalette.placeholder')
  const resolvedEmptyText = emptyText ?? t('commandPalette.empty')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)

  const matches = React.useMemo(() => {
    const result: { item: IrisCommandItem; score: number }[] = []
    for (const item of items) {
      const score = filter(query, item)
      if (score !== null) result.push({ item, score })
    }
    result.sort((a, b) => a.score - b.score)
    return result
  }, [items, query, filter])

  // Preserve sort order but inject a header row when the group changes.
  const groupedFlat = React.useMemo<Row[]>(() => {
    const out: Row[] = []
    let currentGroup: string | undefined
    for (const m of matches) {
      const g = m.item.group
      if (g !== currentGroup) {
        if (g) out.push({ kind: 'header', label: g })
        currentGroup = g
      }
      out.push({ kind: 'item', item: m.item })
    }
    return out
  }, [matches])

  // Enabled (navigable) item rows, paired with their index in groupedFlat.
  const itemRows = React.useMemo(() => {
    const out: { item: IrisCommandItem; flat: number }[] = []
    groupedFlat.forEach((row, i) => {
      if (row.kind === 'item' && !row.item.disabled) out.push({ item: row.item, flat: i })
    })
    return out
  }, [groupedFlat])

  // Flat → enabled-index map. Replaces the previous O(n²) `findIndex` per
  // rendered row (the virtual path also needs it per windowed row).
  const enabledIdxByFlat = React.useMemo(() => {
    const m = new Map<number, number>()
    itemRows.forEach((r, idx) => m.set(r.flat, idx))
    return m
  }, [itemRows])

  // Per-kind row height, memoized on the filtered rows so its identity changes
  // only when the filter result changes (no remeasure churn per keystroke).
  const rowHeight = React.useCallback(
    (flat: number) =>
      groupedFlat[flat]?.kind === 'header' ? COMMAND_HEADER_HEIGHT : COMMAND_ITEM_HEIGHT,
    [groupedFlat],
  )

  // Reproduces today's index-based header keys (`g-${label}-${i}`) exactly —
  // a different formula would remount rows on every filter keystroke. Feeds
  // both the virtualizer's keyed cache and React reconciliation.
  const rowKey = React.useCallback(
    (row: Row, flat: number) => (row.kind === 'header' ? `g-${row.label}-${flat}` : row.item.id),
    [],
  )

  const vsRef = React.useRef<IrisVirtualScrollHandle | null>(null)

  // Scroll the active row into view whenever navigation moves it — arrow
  // keys, wrap-around, query reset, hover — one effect covers every mutation
  // path. Core clamps to the scrollable range, so out-of-range targets
  // (list shrinks below the active row) are safe no-ops.
  React.useLayoutEffect(() => {
    if (!virtual) return
    const target = itemRows[activeIndex]
    if (target) vsRef.current?.scrollToIndex(target.flat)
  }, [virtual, activeIndex, itemRows])

  // Reset filter + active row whenever (re)opened.
  React.useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  // Any query change resets the active row to the top match.
  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useBodyScrollLock(open)
  useFocusTrap({ container: surfaceRef, active: open })

  const close = () => onOpenChange?.(false)

  const runItem = (item: IrisCommandItem) => {
    if (item.disabled) return
    item.action?.()
    onSelect?.(item)
    close()
  }

  const move = (delta: 1 | -1) => {
    const total = itemRows.length
    if (total === 0) return
    setActiveIndex((prev) => (prev + delta + total) % total)
  }

  // Document-level key handling while open — robust for portaled content and
  // lets Escape work even if focus drifts. A ref carries the latest closures so
  // the listener (bound once per open) always sees current activeIndex/itemRows.
  const keyHandlerRef = React.useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandlerRef.current = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Enter': {
        event.preventDefault()
        const target = itemRows[activeIndex]
        if (target) runItem(target.item)
        break
      }
      case 'Escape':
        event.preventDefault()
        close()
        break
    }
  }
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const node = (
    <div
      data-iris-command-palette-backdrop=""
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 1300,
      }}
    >
      <div
        {...rest}
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.label')}
        data-iris-command-palette=""
        tabIndex={-1}
        style={{
          width: 'min(640px, 92vw)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-lg, 8px)',
          boxShadow: 'var(--iris-shadow-xl)',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--iris-border)' }}>
          <input
            type="text"
            value={query}
            placeholder={resolvedPlaceholder}
            data-iris-command-palette-input=""
            aria-label={t('commandPalette.search')}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--iris-font-size-lg, 16px)',
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          />
        </div>
        <ul
          role="listbox"
          aria-label={t('commandPalette.commands')}
          data-iris-command-palette-list=""
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 4,
            // Virtual: the inner scroll root is the scroller — flipping this
            // off prevents a double scrollbar. Plain: unchanged.
            overflow: virtual ? 'hidden' : 'auto',
            flex: 1,
          }}
        >
          {groupedFlat.length === 0 ? (
            <li
              data-iris-command-palette-empty=""
              style={{
                padding: 20,
                textAlign: 'center',
                color: 'var(--iris-muted)',
                fontSize: 'var(--iris-font-size-sm, 13px)',
              }}
            >
              {resolvedEmptyText}
            </li>
          ) : virtual ? (
            <IrisVirtualScroll
              ref={vsRef}
              items={groupedFlat}
              itemHeight={rowHeight}
              height="100%"
              buffer={COMMAND_VIRTUAL_BUFFER}
              keyOf={rowKey}
              renderItem={(row, flat) => renderRow(row, flat, undefined)}
            />
          ) : (
            groupedFlat.map((row, i) =>
              renderRow(row, i, row.kind === 'header' ? `g-${row.label}-${i}` : row.item.id),
            )
          )}
        </ul>
      </div>
    </div>
  )

  return createPortal(node, document.body)

  // Shared row renderer — same li markup for the plain map and the virtual
  // window. In virtual mode the key lives on IrisVirtualScroll's wrapper div
  // (fed from `rowKey`); here it is passed through untouched.
  function renderRow(row: Row, flat: number, key: string | number | undefined): React.ReactElement {
    if (row.kind === 'header') {
      return (
        <li
          key={key}
          data-iris-command-palette-group=""
          style={{
            padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 'var(--iris-letter-spacing-wide, 0.04em)',
            color: 'var(--iris-muted)',
          }}
        >
          {row.label}
        </li>
      )
    }
    const item = row.item
    const enabledIdx = enabledIdxByFlat.get(flat) ?? -1
    const isActive = enabledIdx === activeIndex
    return (
      <li
        key={key}
        role="option"
        aria-selected={isActive ? 'true' : 'false'}
        aria-disabled={item.disabled ? 'true' : undefined}
        data-iris-command-palette-item={item.id}
        data-state={isActive ? 'active' : item.disabled ? 'disabled' : 'idle'}
        onClick={() => {
          if (item.disabled) return
          setActiveIndex(enabledIdx)
          runItem(item)
        }}
        onMouseEnter={() => {
          if (!item.disabled) setActiveIndex(enabledIdx)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--iris-space-sm, 12px)',
          padding: '8px 12px',
          borderRadius: 'var(--iris-radius-sm, 4px)',
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          opacity: item.disabled ? 0.5 : 1,
          background: isActive ? 'var(--iris-surface-hover)' : 'transparent',
          color: 'inherit',
          fontSize: 'var(--iris-font-size-md, 14px)',
        }}
      >
        {item.icon ? (
          <span aria-hidden="true" style={{ width: 20, textAlign: 'center' }}>
            {item.icon}
          </span>
        ) : null}
        <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
        {item.shortcut ? (
          <span
            data-iris-command-palette-shortcut=""
            style={{
              fontSize: 'var(--iris-font-size-xs, 12px)',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
              background: 'var(--iris-background)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-sm, 4px)',
              color: 'var(--iris-muted)',
              fontFamily: 'monospace',
            }}
          >
            {item.shortcut}
          </span>
        ) : null}
      </li>
    )
  }
}
