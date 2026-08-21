import type * as React from 'react'
import type * as TableTypes from '../types'
import type { IrisTableProxyConfig, IrisTableEmptyState } from '../props'
export interface IrisTableQueryProps<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Named view presets (batch AH, iris 独有) — toolbar select of saved snapshots. */
  views?: TableTypes.IrisTableViewConfig
  /** Fired when the active view changes (select / save / delete clears null). */
  onActiveViewChange?: (key: string | null) => void
  /** Batch CT — iris 独有 (vxe has no parity).
   * A `role=tablist` strip rendered ABOVE the toolbar: clicking a tab applies
   * each name in `views` IN ORDER through the same selectView path the toolbar
   * select uses (unknown names are skipped fail-inert; when several views touch
   * the same piece the last applied view wins and the toolbar select mirrors
   * that last view). Fail-closed: without the prop nothing renders, and no tab
   * is active until the first click. */
  tableTabs?: TableTypes.IrisTableTab[]
  /** Natural-language query (iris 独有): controlled string parsed by core
   * `parseTableQuery` (`age > 25 and role in (Test, PM) sort by name asc`);
   * the toolbar query input shows while present, parsed filters AND-merge
   * (`=`/`contains` → substring, `in` → filterValues OR-match, relational →
   * rules); `sort by` seeds only with no sort prop set; proxy comma-joins
   * substring/in into the remote filter map. Controlled-only. */
  query?: string
  /** Fired on every keystroke (parent owns the string). */
  onQueryChange?: (next: string) => void
  /** Render only the horizontally-visible columns plus pinned columns and overscan. */
  columnVirtualization?: boolean
  /**
   * Selection summary (batch AP, iris 独有 — vxe has no parity feature, the
   * header count is its closest cousin): when `selectable === 'multi'` and
   * rows are selected, the toolbar renders `已选 N 行`
   * (`data-iris-selection-summary`, i18n `table.selectionSummary`) plus a
   * `· 合计 X` per leaf column with `summary === 'sum'` (the SAME aggregate
   * material + `aggregateAccuracy` rounding + `String(value)` formatting the
   * summary row uses, computed over the SELECTED rows in bodyData order) and
   * a clear button (`data-iris-selection-clear`) that runs the shared
   * `clearSelection` path. Additive — default off.
   */
  selectionSummary?: boolean
  /** Enable rectangular cell-range selection. */
  cellRange?: boolean
  /**
   * Excel-style drag fill (batch AQ, iris 独有 — vxe has no fill parity):
   * when `cellRange` has a live selected range (≥1 cell), a fill handle
   * (`data-iris-range-fill`, 6px primary square at the range's bottom-right
   * cell) appears; dragging it DOWN or RIGHT cyclically fills the target
   * rectangle from the source range values (`(r, c)` ← source
   * `((r - start.row) % rangeRows + start.row, …)`), formula columns and
   * keyless rows skipped, through ONE batched `commitRowList`, then extends
   * the range to the drag end (Excel parity). Dragging UP/LEFT is ignored
   * (the handle only grows the range). Additive — default off.
   */
  rangeFill?: boolean
  /**
   * Cell drag-move (batch CN, iris 独有 — vxe has no cell-move parity): when
   * `cellRange` has a live selected range (≥1 cell), a move grip
   * (`data-iris-range-move`, 12×4 primary pill on the range's top edge at its
   * top-left cell) appears; dragging it to another cell CUT-MOVES the whole
   * block there (剪切移动 — source cells not covered by the destination rect
   * are cleared; locked/readonly and formula cells survive both phases) and
   * the selection follows the moved block (Excel parity). The drag end clamps
   * so the block always fits (down/up/right/left 越界). Zero-commit no-op
   * when the drag stays on the source block. Inert without `cellRange`.
   * Additive — default off.
   */
  cellDrag?: boolean
  /** Clipboard batch (vxe-grid clipboard-config parity, batch O): Ctrl/Cmd+C copies the selected cell range; Ctrl/Cmd+V pastes TSV text into the range anchor onward (overflow beyond the last row/col is ignored). Requires `cellRange` to have a live selected range; additive — default off.
   * Batch BP (iris 独有 — vxe clipboard-config has no output-format switch): `copyFormat` selects the copy OUTPUT format for BOTH consumption points (Ctrl/Cmd+C and the range toolbar 复制 button) — `'tsv'` (default, byte-identical to batch O) / `'csv'` (RFC-4180, headerless range fiat like the 导出 CSV download) / `'html'` (a `<table>` fragment via core `toHtml`, with a header row of column titles — the toHtml contract — and the masked cell values, the batch-AY invariant across all three formats). Paste is unaffected — it always reads `\t`-delimited text. Invalid runtime values fail-closed to `'tsv'`.
   * Batch CU (iris 独有 — vxe clipboard-config always copies raw values, no format-preserving copy): `copyWithFormat` copies the FORMATTED text of formatter columns (the `contextCellText` display chain — mask → formatter → String, the same chain as the context-menu 复制值) instead of the raw/masked value, across ALL THREE `copyFormat` serializers. Only `col.formatter` columns switch chains — non-formatter columns stay byte-identical — and the formatted STRING still flows through the same serializers (RFC-4180 quoting + OWASP neutralization still apply). `exportRaw`'s copy-path skip is superseded on formatter columns (mask → formatter always); exports are untouched.
   */
  // NOTE: keep the inline object single-line — the manifest scanner reads member types line-wise (multi-line object props degrade to a bare object type, rowDrag precedent).
  // prettier-ignore
  clipConfig?: { copy?: boolean; paste?: boolean; copyFormat?: 'tsv' | 'csv' | 'html'; copyWithFormat?: boolean }
  /** Paste options (iris 独有 — vxe-grid clipboard-config has no overflow-insert switch):
   * `insertIfOverflow` makes a SINGLE-CELL paste append clipboard lines that run past
   * the last row as brand-new rows (auto-id keys via `insertRowInList`, surplus cells
   * dropped, locked/readonly columns skipped) — one batched commit. Multi-cell
   * rectangle pastes stay clipped (fiat) and the default (absent) keeps batch-O
   * overflow-drop behavior byte-identical. Additive — default off.
   */
  pasteOptions?: { insertIfOverflow?: boolean }
  /** Find & replace (vxe-grid find parity, batch O): Ctrl/Cmd+F (when not editing) opens a find/replace bar above the table; Enter/Shift+Enter step through matches; Esc closes and clears highlights. Matches over bodyData (flat mode), case-insensitive substring. Additive — default off. */
  fnr?: boolean
  /** Batch CK (iris 独有 — vxe has no inline search highlight): a
   * case-insensitive literal-substring search over each text cell's display
   * chain (mask → formatter ?? raw — the same text autoLink consumes); every
   * occurrence renders as an inline `<mark data-iris-search-hit>` (the
   * surface-selected token — the same search-highlight language fnr uses for
   * matched cells). Display-only: no bar, no match state, no write-back —
   * the distinction from fnr is the mechanism, not the query.
   * `render`/`html`/`link`/`autoLink`/sparkline cells are untouched
   * (documented fiats). Additive; default off (fail-closed).
   */
  searchHighlight?: string
  /** Built-in undo/redo (iris 独有 — vxe has no built-in undoRedoHistory): when enabled, every data mutation (row ops, paste, find&replace, range clear, cell/row edits, batch edit) records the POST-change row list; Ctrl/Cmd+Z undoes and Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redoes — never while an inline editor is open. The toolbar renders ↶/↷ buttons after the title (disabled from canUndo/canRedo); restores prune selection keys that no longer exist. Additive — default off. */
  undo?: boolean
  /** Shift-click checkbox range selection (vxe checkboxConfig `isShiftKey`
   * parity, batch G): shift-clicking a row checkbox toggles every
   * checkMethod-eligible row between the last-clicked anchor row and the
   * target (in body order); a plain click just moves the anchor. The header
   * select-all resets the anchor. Default false. */
  checkboxRange?: boolean
  /** Row-selection drag range (batch BT, iris 独有 — vxe has no mouse-drag
   * checkbox range): pressing the row-selection cell in multi mode and
   * dragging past the 4px threshold continuously checks every
   * checkMethod-eligible row between the pressed anchor row and the hovered
   * row (closed interval in body order); checkMethod-disabled rows are
   * skipped. The applied set only ever grows during one drag (reverse drags
   * shrink the interval but never uncheck); a plain click still toggles a
   * single row. Default false. */
  selectionDrag?: boolean
  /** Empty state node (replaces the row body when `data` is empty). Also accepts
   * an `IrisTableEmptyState` descriptor (iris 独有 — vxe has no empty-state
   * action button): `{ text?, action? }` renders the text plus an inline action
   * button on the same row. */
  emptyState?: React.ReactNode | IrisTableEmptyState
  /** Show the loading state instead of rows. */
  loading?: boolean
  /** Show the error state instead of rows (takes precedence over loading). */
  error?: boolean
  /** Custom loading-state node. */
  loadingState?: React.ReactNode
  /** Custom error-state node. */
  errorState?: React.ReactNode
  /** Fired by the built-in Retry button in the error state row. */
  onRetry?: () => void
  /**
   * Server-side data proxy (vxe-grid proxyConfig parity, query slice). When
   * set, rows come from the proxy `query` (paged) and a pager renders below
   * the body; `loading`/`error` are driven by the proxy state.
   */
  proxyConfig?: IrisTableProxyConfig<Row>
  /** Cell tooltips (vxe-grid tooltipConfig parity, title mode, batch G): a
   * native `title` on every body cell, content from the callback or the raw
   * cell value; editing cells are exempt and empty content drops the tooltip.
   * With `showAll: false`, titles remain only for cells whose single-line
   * content measures wider than the rendered cell; SSR/jsdom zero-width
   * layouts fail open and retain the title. */
  tooltipConfig?: TableTypes.IrisTableTooltipConfig<Row>
  /** Cell annotations (iris 独有, batch AZ — vxe has no cell-note concept): a
   * static map of notes keyed `${rowKey}::${columnKey}` — the same `::`
   * delimiter as the internal `cellId` (`annotations[cellId(k, col.key)]`).
   * A noted cell renders a corner badge (`data-iris-cell-note-badge`) + gets
   * `data-iris-cell-note` + the note as its title (beats `tooltipConfig`);
   * the dynamic `cellNote` callback wins over this map when both are set. */
  annotations?: Record<string, string>
  /** Dynamic per-cell note (iris 独有, batch AZ): computed from the row +
   * column — wins over the static `annotations` map. With a note the cell
   * gets `data-iris-cell-note` + a corner badge + the note as its title
   * (beats `tooltipConfig`); a null/'' note renders nothing. */
  cellNote?: (row: Row, column: TableTypes.IrisTableColumn<Row>) => string | null
  /** Hover note preview (batch BM, iris 独有 — vxe has no cell-note concept,
   * and its tooltip can only show the cell value): with `notePopover`, hovering
   * a noted cell shows a floating popover (`data-iris-note-popover`, role
   * tooltip, pure display — pointer-events none) anchored to the cell's badge
   * corner INSTEAD of the native `title`; Escape / outside pointer-down /
   * any scroll close it. Content-only: zero i18n / core. */
  notePopover?: boolean
  /**
   * Annotation editing (batch BB, iris 独有 — vxe has no note editing): when
   * true, the context menu gains built-in items 添加批注 / 编辑批注 / 删除批注
   * (keys `__iris-annotate` / `__iris-annotate-edit` / `__iris-annotate-remove`,
   * i18n `table.annotate(.edit/.remove)`) appended AFTER the summary item,
   * chosen by the clicked cell's existing note (add when none, edit+remove
   * when one). The add/edit items open a floating annotate panel
   * (`data-iris-annotate-panel`) — textarea seeded from
   * `annotations[cellId(rowKey, col.key)]` + 保存 (`data-iris-annotate-save`)
   * + 删除 (`data-iris-annotate-remove`, only when a note exists); the remove
   * item deletes the cell's annotation directly. Requires `contextMenu`;
   * writes flow through `onAnnotationsChange` — without it the items still
   * show but save/remove are inert (documented).
   */
  annotationEditing?: boolean
  /**
   * Annotation write channel (batch BB, iris 独有): receives the NEXT
   * annotations map on every annotate-panel save — empty text removes the
   * cell's key, non-empty sets it — and on remove (menu item or panel
   * button). The map stays fully controlled: `annotations` remains the read
   * source and the table holds no internal annotation state (same shape and
   * ownership as `onFiltersChange`).
   */
  onAnnotationsChange?: (next: Record<string, string>) => void
  /**
   * Collaborative-presence cursors (batch BD, iris 独有 — vxe has no cursor
   * sharing): remote participants' selected cells. Each entry draws a 2px
   * colored outline on its cell (`data-iris-presence="true"`, outline in the
   * entry's `color` — first entry wins when several share a cell) plus a
   * corner label with the participant's name (`data-iris-presence-label`
   * with `-id`/`-name`). Pure display: the table holds no collaboration
   * state, so a NEW array reference re-renders while in-place mutation does
   * not (same controlled contract as `data` / `annotations`).
   */
  presence?: TableTypes.IrisTablePresenceEntry[]
  /** Header cell tooltips (vxe header-tooltip-config parity, batch P): a
   * native `title` on flat + grouped header cells; empty content drops the
   * tooltip. */
  headerTooltipConfig?: { content?: (column: TableTypes.IrisTableColumn<Row>) => string }
  /** Footer cell tooltips (vxe footer-tooltip-config parity, batch P): a
   * native `title` on summary / footer-method / footer-data cells; empty
   * content drops the tooltip. */
  footerTooltipConfig?: { content?: (column: TableTypes.IrisTableColumn<Row>) => string }
  /**
   * Right-click context menu (vxe-grid contextMenu parity, batch H). Opens on
   * body leaf cells only — header, seq, selection, expand, summary and footer
   * cells never open it. The menu floats at the cursor (virtual anchor),
   * closes on Escape / outside pointer-down / any scroll, and fires `onSelect`
   * with the clicked item's key and the cell's grid coordinates.
   *
   * Batch BW (iris 独有): EVERY menu unconditionally gains two built-in quick
   * actions after the user items (and after the value-distribution / summary
   * items when those props are on, before the annotate items) — 复制值
   * (key `__iris-copy-value`, i18n `table.copyValue`, copies the cell's
   * display text — mask → formatter → String — to the clipboard) and 清空
   * (key `__iris-clear-cell`, i18n `table.clearCell`, writes the cell to ''
   * through the same commitRowList funnel as the Delete shortcut — undo /
   * audit / onDataChange covered; locked/readonly cells no-op). Both keys are
   * intercepted at the onSelect wiring, so the user callback never sees them;
   * without a clipboard the copy no-ops safely.
   *
   * Set `formatActions` to true to additionally append opt-in region format
   * actions (number to two decimals and uppercase text). They remain
   * intercepted by the table and use the same commit funnel; the default is
   * false so an ordinary context menu is unchanged.
   */
  contextMenu?: {
    items: (
      params: TableTypes.IrisTableContextMenuParams<Row>,
    ) => Array<{ key: string; label: string; disabled?: boolean }>
    onSelect: (key: string, params: TableTypes.IrisTableContextMenuParams<Row>) => void
    formatActions?: boolean
  }
  /**
   * Value distribution panel (batch AM, iris 独有): when true, the context
   * menu gains a built-in item (key `__iris_distribution`, i18n
   * `table.distribution`) that opens a floating panel counting each distinct
   * value of the CLICKED column over the current body rows — top 20 + a
   * muted "其余 N 个" fold — computed by the core `valueDistribution`
   * material over `bodyData` with the `dataIndex ?? key` indirection.
   * Requires `contextMenu` to be set (the item appends to its items). */
  valueDistribution?: boolean
  /**
   * NL column summary (batch AW, iris 独有 — vxe has no equivalent; its
   * closest analog is a hand-built aggregate footer, which never tells you in
   * one line what a column IS): when true, the context menu gains a built-in
   * item (key `__iris-summary`, i18n `table.summary`) appended AFTER the
   * value-distribution item; selecting it opens a floating panel
   * (`data-iris-summary-panel`) showing the core `summarizeColumn`
   * natural-language summary of the clicked column's values over `bodyData`
   * — a
   * numeric column gets `共 N 个值，范围 min–max，平均 avg，M 个缺失`, a
   * categorical one its top-3 shares (`,` percentages) + a muted
   * `，其余 R 个` fold. Requires `contextMenu` (pairs naturally with
   * `valueDistribution`); Esc / outside / scroll close it like the
   * distribution panel.
   */
}
