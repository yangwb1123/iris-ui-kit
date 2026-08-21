import type { IrisTableColumn } from './column'

/** Params delivered to `IrisTableProps.footerMethod` (vxe footer-method parity). */
export interface IrisTableFooterMethodParams<Row = Record<string, unknown>> {
  /** Leaf columns of the table (grouped headers flattened). */
  columns: IrisTableColumn<Row>[]
  /** Full body rows (sorted + filtered). */
  data: Row[]
}

export interface IrisTableCellEditEvent<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  oldValue: unknown
  newValue: unknown
  rowIndex: number
}

/** Params delivered to `IrisTableProps.onEditStart` (vxe edit-activated parity, batch V). */
export interface IrisTableEditStartParams<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
}

/**
 * Params delivered to `IrisTableProps.onEditClosed` (vxe edit-closed parity,
 * batch V). Cell mode only — row-edit sessions commit per column through
 * their own stores and are not reported (documented simplification); an
 * async-validating commit that lands after `commitEdit` returned is also not
 * reported (the sync path fires with the committed value).
 */
export interface IrisTableEditClosedParams<Row = Record<string, unknown>> {
  row: Row
  column: IrisTableColumn<Row>
  rowIndex: number
  /** The committed value; undefined when the edit was cancelled. */
  value?: unknown
  /** true when the edit was cancelled (Escape) instead of committed. */
  cancelled: boolean
}

/** Scroll coordinates delivered to `IrisTableProps.onScroll` (vxe scroll parity, batch V). */
export interface IrisTableScrollParams {
  scrollTop: number
  scrollLeft: number
}

export type IrisTableRenderDetail<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => import('react').ReactNode

export type IrisTableRowExpandable<Row = Record<string, unknown>> = (
  row: Row,
  rowIndex: number,
) => boolean

/**
 * Cell tooltip configuration (vxe-grid tooltipConfig parity, title mode).
 * Renders a native `title` on every body cell — no portal, no positioning.
 * Empty content drops the tooltip (vxe empty-content parity); editing cells
 * are exempt.
 */
export interface IrisTableTooltipConfig<Row = Record<string, unknown>> {
  /**
   * Render a tooltip on every body cell. Default true when `tooltipConfig` is
   * set. With `false`, the native `title` is emitted only when the cell's
   * single-line content is measured wider than its rendered box; the table
   * rechecks after root resize. SSR/jsdom (where layout dimensions are zero)
   * fail open and keep the title. `true` keeps the title on every non-empty
   * cell.
   */
  showAll?: boolean
  /**
   * Custom tooltip text for a cell. Defaults to the raw cell value. Returning
   * an empty string drops the tooltip (vxe empty-content parity).
   */
  content?: (row: Row, column: IrisTableColumn<Row>) => string
}

/**
 * One header-merge entry (vxe-grid mergeHeaderCells parity, batch P). The
 * coordinate space is the FLAT header's leaf-column index: `row` 0 only —
 * entries with `row` > 0 are ignored (the flat header is a single row), and
 * grouped headers are NOT merged (documented simplification).
 */
export interface IrisTableMergeCell {
  /** Header row index — only 0 is supported (flat header). */
  row: number
  /** Leaf-column index of the merged cell's origin. */
  col: number
  /** Columns spanned (gridColumnEnd); the covered cells render null. */
  colspan?: number
  /** Rows spanned (gridRowEnd); inert on the single flat header row. */
  rowspan?: number
}

/**
 * Span result shared by `spanMethod` and `footerSpanMethod` (vxe
 * span-method / footer-span-method parity): both dimensions default to 1;
 * values > 1 make the cell span adjacent cells, which then render null.
 * Footer note: `rowspan` is inert in the footer stack (each footer row is
 * its own grid container — see `footerSpanMethod`).
 */
export interface IrisTableSpan {
  rowspan?: number
  colspan?: number
}

/** Params delivered to `IrisTableProps.footerSpanMethod` (vxe footer-span-method parity, batch P). */
export interface IrisTableFooterSpanParams<Row = Record<string, unknown>> {
  /** 0-based row index over the rendered footer stack (footerMethod rows →
   * summary row → footerData rows, whichever render). */
  rowIndex: number
  columnIndex: number
  /** Leaf columns of the table (grouped headers flattened). */
  columns: IrisTableColumn<Row>[]
  /** Full body rows (sorted + filtered). */
  data: Row[]
}

/** Footer cell merge callback (vxe footer-span-method parity, batch P). */
export type IrisTableFooterSpanMethod<Row = Record<string, unknown>> = (
  params: IrisTableFooterSpanParams<Row>,
) => IrisTableSpan | null

/** vxe-grid scrollbarConfig parity (batch Q): `theme: 'thin'` → 6px webkit + Firefox `scrollbar-width: thin` via `data-iris-scrollbar-thin`. */
export type IrisTableScrollbarConfig = { theme?: 'default' | 'thin' }

/** vxe-grid editDirtyConfig parity (batch Q): a committed cell whose value
 * differs from its pre-edit original renders a primary dot
 * (`data-iris-cell-dirty`); committing the original value clears it.
 * `indicator: false` suppresses the dot (tracking stays); `className: true`
 * also adds an `iris-table-cell-dirty` class for custom styling. */
export type IrisTableEditDirtyConfig = { indicator?: boolean; className?: boolean }

/**
 * One conditional-formatting rule (batch AX, iris 独有 — vxe has no built-in
 * conditional-formatting engine). Passed via `IrisTableProps.conditionalStyles`:
 * a rule matches a body cell when its optional `column` filter (omitted →
 * every column) equals the cell's column key AND `when(row, value)` returns
 * true — `value` is the RAW cell value (`dataIndex ?? key` resolved, formula
 * columns computed via `getCellValue`). Matching rules merge in array order
 * after `cellStyle`; later rules win on conflicting style keys.
 */
export interface IrisTableConditionalStyle<Row = Record<string, unknown>> {
  /** Column key the rule applies to; omitted → every column. */
  column?: string
  /** Match predicate: `row` is the full row object, `value` the raw cell value. */
  when: (row: Row, value: unknown) => boolean
  /** Inline styles merged onto the body cell when the rule matches. */
  style: import('react').CSSProperties
}

/**
 * One footer-merge entry (vxe-grid mergeFooterItems parity, batch R). The
 * coordinate space matches `footerSpanMethod`: `row` is the 0-based index
 * over the rendered footer stack (footerMethod rows → summary row →
 * footerData rows, whichever render) and `col` the leaf-column index — both
 * start at 0. The function (`footerSpanMethod`) wins when both are provided.
 */
export interface IrisTableMergeFooterItem {
  /** 0-based footer-stack row index (footerMethod rows → summary row → footerData rows). */
  row: number
  /** Leaf-column index of the merged cell's origin. */
  col: number
  /** Columns spanned (gridColumnEnd); the covered cells of the same row render null. */
  colspan?: number
  /** Rows spanned — INERT (each footer row is its own grid container, so
   * `gridRowEnd` cannot cross rows): covered cells of later rows keep their
   * own data, like `footerSpanMethod`'s rowspan. */
  rowspan?: number
}

/**
 * Imperative row operations (vxe-grid insert/remove/setRow parity, key
 * addressing). Assigned to `tableRef.current` on mount; every op applies a
 * core pure helper, commits through the cell-edit write-back channel and
 * fires `onDataChange`. Missing keys are silent no-ops.
 */
