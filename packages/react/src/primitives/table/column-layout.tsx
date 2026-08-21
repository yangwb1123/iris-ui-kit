import * as React from 'react'
import type { IrisTableColumn } from './types'
import { useDrag } from '../drag/useDrag'
import { DEFAULT_PINNED_WIDTH } from './styles'

const RESIZE_STEP = 16

/** Auto-fit measurement (batch DG, iris 独有): the widest rendered content
 * width for a column — header + body cells' `scrollWidth`. Cells are
 * `nowrap + overflow:hidden` with symmetric padding, so `scrollWidth` already
 * includes both-side padding — "max content width + padding" needs no extra
 * term. Virtual scrolling measures only the rendered window (vxe autoResize
 * behavior); group headers share the same flat leaf query. Empty / detached
 * cells (scrollWidth 0) are ignored; caller clamps + rounds before writing. */
export function measureColumnContentWidth(container: ParentNode | null, colKey: string): number {
  if (!container) return 0
  let max = 0
  container
    .querySelectorAll(`[data-iris-table-cell="${colKey}"],[data-iris-table-header="${colKey}"]`)
    .forEach((el) => {
      const w = (el as HTMLElement).scrollWidth
      if (w > max) max = w
    })
  return max
}

export function ColumnResizeHandle({
  colKey,
  label,
  width,
  minWidth,
  maxWidth,
  onResize,
  onAutoFit,
  widthHint = false,
}: {
  colKey: string
  label: string
  width: number | undefined
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
  onAutoFit?: (key: string) => void
  widthHint?: boolean
}): React.ReactElement {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const startRef = React.useRef(0)
  const [hint, setHint] = React.useState<{ width: number; x: number; y: number } | null>(null)
  const clamp = (w: number): number => Math.max(minWidth, Math.min(maxWidth, Math.round(w)))
  // Prefer the explicit override; fall back to the rendered header width.
  const measure = (): number =>
    width ?? ref.current?.parentElement?.getBoundingClientRect().width ?? minWidth

  useDrag({
    handle: ref,
    onStart: ({ x, y }) => {
      startRef.current = measure()
      if (widthHint) setHint({ width: clamp(startRef.current), x, y })
    },
    onDrag: ({ dx, x, y }) => {
      const next = clamp(startRef.current + dx)
      onResize(colKey, next)
      if (widthHint) setHint({ width: next, x, y })
    },
    onEnd: () => setHint(null),
  })

  return (
    <span
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      tabIndex={0}
      data-iris-table-resize-handle=""
      data-column-key={colKey}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (onAutoFit) onAutoFit(colKey)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          onResize(colKey, clamp(measure() - RESIZE_STEP))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          onResize(colKey, clamp(measure() + RESIZE_STEP))
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {widthHint && hint ? (
        <span
          data-iris-width-hint=""
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: hint.x + 8,
            top: hint.y - 32,
            zIndex: 'var(--iris-z-popover, 1000)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            background: 'var(--iris-surface-floating, var(--iris-surface))',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            fontSize: 'var(--iris-font-size-xs, 12px)',
          }}
        >
          {hint.width}px
        </span>
      ) : null}
    </span>
  )
}

/** Width resolution shared by the pinned boundary (batch CV) and pinnedOffsets:
 * explicit override → column-declared number → default approximation. */
export function isValidColumnWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function resolvedColumnWidth<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
  widths: Record<string, number>,
): number {
  const override = widths[col.key]
  if (isValidColumnWidth(override)) return override
  if (isValidColumnWidth(col.width)) return col.width
  return DEFAULT_PINNED_WIDTH
}

/** Natural width of a responsive top-level column. Groups keep their unit
 * intact during narrow-width collapse, so their budget is the sum of leaves. */
export function responsiveNaturalWidth<Row extends Record<string, unknown>>(
  col: IrisTableColumn<Row>,
  widths: Record<string, number>,
): number {
  if (col.children && col.children.length > 0) {
    return col.children.reduce((sum, child) => sum + responsiveNaturalWidth(child, widths), 0)
  }
  return resolvedColumnWidth(col, widths)
}

/** Number of leading leaf columns pinned left, capped at `cap` (the first
 * right-pinned index — a left boundary never crosses into the right block).
 * Reads through the SAME pinOf throat as every render path. */
export function leftPinnedCount<Row extends Record<string, unknown>>(
  cols: readonly IrisTableColumn<Row>[],
  pinOf: (col: IrisTableColumn<Row>) => 'left' | 'right' | null,
  cap: number,
): number {
  let count = 0
  for (let i = 0; i < cap; i += 1) {
    if (pinOf(cols[i]!) === 'left') count = i + 1
    else return count
  }
  return count
}

/** New left-pinned count for a boundary drag (batch CV): the widest prefix
 * whose cumulative width stays within `budget` (the boundary position
 * relative to the lead columns' trailing edge = current pinned width + dx),
 * clamped to `cap`. Widths approximate via resolvedColumnWidth — the same
 * fallback chain as pinnedOffsets (documented fiat). */
export function pinnedCountFromBudget<Row extends Record<string, unknown>>(
  cols: readonly IrisTableColumn<Row>[],
  widthOf: (col: IrisTableColumn<Row>) => number,
  budget: number,
  cap: number,
): number {
  let acc = 0
  for (let i = 0; i < cap; i += 1) {
    const w = widthOf(cols[i]!)
    if (acc + w <= budget) acc += w
    else return i
  }
  return cap
}

/**
 * Draggable separator at the pinned boundary (batch CV, iris 独有 — vxe has
 * no pinned boundary handle): rendered inside the LAST left-pinned leaf
 * header cell, whose trailing edge inherits the cell's sticky positioning.
 * Pointer drag shows a translateX ghost and commits on release; Arrow-Left /
 * Arrow-Right nudge the count by one (resolve(0) = the current count).
 * `role="separator"` + `aria-orientation` follow the window-splitter pattern
 * (ColumnResizeHandle precedent). The React onPointerDown stopPropagation
 * keeps the columnDrag arm-race away — the NATIVE useDrag listener on the
 * span itself still arms (react-drag order: native at span → React root
 * dispatch, so the cell's synthetic pointerdown never runs).
 */
export function PinnedDragHandle({
  colKey,
  label,
  resolve,
  commit,
}: {
  colKey: string
  label: string
  resolve: (dx: number) => number
  commit: (count: number) => void
}): React.ReactElement {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const [dx, setDx] = React.useState(0)
  const dragging = dx !== 0

  useDrag({
    handle: ref,
    onStart: () => setDx(0),
    onDrag: ({ dx }) => setDx(dx),
    onEnd: ({ dx }) => {
      commit(resolve(dx))
      setDx(0)
    },
  })

  return (
    <span
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Adjust pinned column count at ${label}`}
      tabIndex={0}
      data-iris-pinned-drag-handle=""
      data-column-key={colKey}
      data-iris-pinned-drag-active={dragging ? 'true' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          commit(resolve(0) - 1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          commit(resolve(0) + 1)
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 2,
        transform: dragging ? `translateX(${dx}px)` : undefined,
      }}
    >
      <span
        aria-hidden="true"
        data-iris-pinned-drag-line=""
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          insetInlineStart: '50%',
          width: 2,
          background: 'var(--iris-primary)',
          transform: 'translateX(-50%)',
        }}
      />
    </span>
  )
}
