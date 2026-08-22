import type * as Core from '@iris-ui-kit/core'
import type * as TableTypes from '../types'
export interface IrisTableEditingProps<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Column drag-sort (vxe-grid columnDragConfig parity). Reorders leaf
   * columns on drop; parent owns columns (pass the reordered array back).
   * Batch CH (iris 独有 — vxe has no drag-out pin): when `columnPinMenu` is
   * ALSO on, dragging a column header past the table's LEFT edge pins it
   * left on release (drag-out pin) instead of reordering — a second gesture
   * into the pin menu's state channel (same `onColumnPinnedChange` contract,
   * both controlled/uncontrolled modes, never a reorder). Plain `columnDrag`
   * without `columnPinMenu` keeps the vxe reorder-only behavior.
   * Batch DK (iris 独有): a pinned intra-zone reorder ALSO fires
   * `onColumnOrderChange` with the new top-level key list (flat leaf tables
   * only; grouped leaves stay `onReorder`-only) so a header frozen-zone
   * reorder is durable for controlled parents through the same channel the
   * settings panel uses.
   */
  columnDrag?: {
    /** Called with the reordered column array after a drop. */
    onReorder: (columns: TableTypes.IrisTableColumn<Row>[]) => void
  }
  /** Render a leading sequence-number column (vxe-grid seqConfig parity). */
  seq?: boolean
  /**
   * Excel-style row/column references (batch AO, iris 独有 — vxe seqConfig
   * shows numbers only, no column letters): muted A/B/C… letter badges
   * (`data-iris-cell-ref`) after every LEAF header title (A = first leaf;
   * seq/selection/detail/drag columns are skipped, grouped leaves follow
   * source order) plus a leading row-number column 1, 2, 3…
   * (`data-iris-row-ref`). When `seq` is on the seq column IS the row
   * number — no duplicate column. Additive — default off.
   */
  showCellRefs?: boolean
  /**
   * Cell merge (vxe-grid spanMethod parity): return `{ rowspan, colspan }`
   * for a cell at (rowIndex, columnIndex); both default 1. Values > 1 make
   * the cell span adjacent cells (the spanned cells are skipped).
   */
  spanMethod?: (params: {
    rowIndex: number
    columnIndex: number
  }) => { rowspan?: number; colspan?: number } | null | undefined
  /**
   * Header merge (vxe-grid mergeHeaderCells parity, batch P): merge entries
   * keyed by leaf-column index of the FLAT header row (`row` 0 only — rows
   * > 0 are ignored). A merge cell renders with `gridColumnEnd: span
   * colspan` / `gridRowEnd: span rowspan`; the covered cells render null.
   * Grouped headers and `columnVirtualization` are not merged (documented
   * simplification).
   */
  mergeHeaderCells?: TableTypes.IrisTableMergeCell[]
  /**
   * Footer merge (vxe-grid mergeFooterItems parity, batch R): declarative
   * span entries in the SAME coordinate space as `footerSpanMethod` — `row`
   * is the 0-based index over the rendered footer stack (footerMethod rows →
   * summary row → footerData rows, whichever render) and `col` the
   * leaf-column index; both start at 0. A merge cell renders `gridColumnEnd:
   * span colspan`; the covered cells of the same row render null. `rowspan`
   * is inert (each footer row is its own grid container — covered cells of
   * later rows keep their own data; mirrors `footerSpanMethod`'s rowspan).
   * The function wins: when `footerSpanMethod` is provided,
   * `mergeFooterItems` is ignored. Entries outside the rendered stack are
   * no-ops.
   */
  mergeFooterItems?: TableTypes.IrisTableMergeFooterItem[]
  /**
   * Row key fallback (vxe-grid deprecated string `rowId` parity, re-typed as
   * a function, batch R): when a row lacks the `rowKey` field, this callback
   * supplies the row's key — used by selection, expansion, dirty tracking,
   * editing and tree flattening. `rowKey` wins over `rowId`; without either,
   * the row index is used at index-bearing call sites (unchanged). The
   * imperative handle's row ops, clipboard paste and find&replace write-backs
   * still address rows by the `rowKey` field only (keyless rows are skipped
   * there). */
  rowId?: (row: Row, rowIndex: number) => string | number
  /** Row drag-sort configuration (composed over core createSortable). */
  rowDrag?: {
    /** Reorder callback — receives the reordered row array (parent owns data). */
    onReorder: (rows: Row[]) => void
  }
  /** Batch DQ (iris 独有): drop a dragged row on an external element whose `data-iris-drop-zone` value matches `key`; the parent owns the zone DOM. */
  rowDragBetween?: TableTypes.IrisTableRowDragBetweenTarget<Row>[]
  /** Inline-edit configuration (vxe-grid editConfig parity). */
  editConfig?: {
    /** What opens the editor. Default `'dblclick'`. */
    trigger?: 'click' | 'dblclick' | 'manual'
    /** Show a required asterisk next to headers of columns with rules. */
    showAsterisk?: boolean
    /** Drop the draft when opening another cell without committing. */
    autoClear?: boolean
    /** Edit mode (vxe editConfig.mode parity, batch K): `'cell'` (default) edits one cell at a time; `'row'` opens every editable column of the clicked row together — Enter/blur commits THAT column, Escape cancels the whole row, clicking another row commits the current row's open editors first. */
    mode?: 'cell' | 'row'
  }
  /** Edit-validation presentation (vxe-grid ValidConfig parity). */
  validConfig?: TableTypes.IrisTableValidConfig
  onCellEdit?: (event: TableTypes.IrisTableCellEditEvent<Row>) => void
  /** Edit start (vxe edit-activated parity, batch V): fired when an inline editor opens (cell double-click; cell mode only). */
  onEditStart?: (params: TableTypes.IrisTableEditStartParams<Row>) => void
  /** Edit close (vxe edit-closed parity, batch V): fired when an edit session ends — `cancelled: false` carries the committed value, `cancelled: true` when Escape discarded it. Cell mode only (see `TableTypes.IrisTableEditClosedParams`). */
  onEditClosed?: (params: TableTypes.IrisTableEditClosedParams<Row>) => void
  /** Batch BQ (iris 独有): auto-save committed inline edits — after a successful commit, fire `onAutosave` with the post-commit row list (parent persistence hook; orthogonal to `onDataChange`, which inline edits never trigger). `editAutosave` is the feature switch — `onAutosave` alone is inert (keymap precedent). No-op commits (same value), cancelled (Escape) and validation-failed edits never fire; row edit mode fires per committed column. */
  editAutosave?: boolean
  /** Batch BQ (iris 独有): parent persistence hook fired by `editAutosave` with the post-commit row list. */
  onAutosave?: (rows: Row[]) => void
  /** Batch CC (iris 独有): textarea editors auto-grow their height with content — 1 row to start, up to a 6-row cap, then scroll inside the editor (measured via scrollHeight on input, no re-render loop). Off by default (fail-closed; batch I's rows=3 stays). */
  editAutoHeight?: boolean
  /** Batch CG (iris 独有 — vxe has no equivalent; Excel-style status-bar parity):
   * a live character count in the editing cell's bottom-right corner (cell AND
   * row edit modes, recomputed per keystroke from the session draft) plus a
   * cell-count/sum badge at the selected range's bottom-right cell when
   * `cellRange` has a live selection (a pure reduction over the rangeStats
   * material — count = Σ column non-null counts, sum = Σ numeric column sums,
   * `null` = no numeric data — rounded via the same `aggregateAccuracy` gate as
   * the summary row). Additive; default off (fail-closed).
   */
  charCount?: boolean
  /** Batch CQ (iris 独有 — vxe has no equivalent): show a live preview of the
   * formatter-applied result below the editing cell — recomputed per keystroke
   * from the session draft through the SAME display chain as the committed cell
   * (mask → formatter, with the commit path's draft coercion for number/select
   * editors), rendered as a muted small line (`data-iris-edit-preview`). Only
   * columns with a `formatter` render a preview. Additive; default off
   * (fail-closed).
   */
  editPreview?: boolean
  /** Batch DH (iris 独有 — vxe has no equivalent; data-consistency assist):
   * while an inline (cell-mode) editor is open, every other cell in the SAME
   * column whose committed value exactly matches the current draft renders a
   * light highlight (`data-iris-input-hint` + a `--iris-input-hint` token
   * background) — a glanceable "these rows already share this value" cue
   * while typing. Matching is RAW (`String(raw) === String(draft)`, same
   * draft caliber as the editor/commit path — not the masked/formatted
   * display). The editing cell itself is exempt. An empty draft is
   * fail-closed (never floods the whole column). Computed live per keystroke
   * via the existing cell-edit store — zero new state. Row-edit mode is a
   * documented fiat: each column's draft lives in its own session, so row
   * mode does not participate. Additive; default off (fail-closed).
   */
  pattern?: boolean
  /** Batch DL (iris 独有): alias for the pattern-edit consistency hint. While
   * an inline draft is open, matching committed values in the same column get
   * `data-iris-input-hint`; kept as a separate switch for the batch contract. */
  patternFill?: boolean
  /** Batch CR (iris 独有 — vxe has no equivalent; Excel status-bar parity):
   * show a full-width horizontal strip directly below the toolbar
   * (`data-iris-column-totals`) with the column totals for every
   * `summary === 'sum'` column — aggregated over the CURRENT body rows with
   * the exact summary-row value pipeline (`aggregate` + the
   * `aggregateAccuracy` rounding gate + `renderSummary` fallback), one grid
   * cell per leaf column (`data-iris-column-totals-cell`) so tracks stay
   * aligned; non-sum columns render empty placeholders. The strip shows even
   * with an empty body (`0`). Additive; default off (fail-closed).
   */
  columnTotals?: boolean
  /** Batch CS (iris 独有 — vxe has no equivalent; vxe keeps the pixel offset, never re-anchors).
   * In virtual mode, an expansion commit re-locates the first visible row
   * (the content anchor, with its partial offset) in the NEW plan and
   * writes `newIndex × slotHeight + relativeTop` — the rows under the
   * cursor stay put across tree/detail expand AND collapse. Uniform slot
   * heights only (`rowHeight`/`virtualScroll.itemHeight` functions are
   * pixel-only — the variable-height offset tree is child-internal);
   * non-virtual tables are inert (documented fiat); full-set restores
   * (`expandAll` / `persistState` replay) fall back to the virtualizer's
   * re-clamp; a single-key commit stays exact. Additive; default off
   * (fail-closed).
   */
  expandScrollPreserve?: boolean
  /** Batch CJ (iris 独有 — vxe has no shortcut help): show a `?` toolbar
   * trigger that opens a floating panel listing every built-in keyboard
   * shortcut with its EFFECTIVE key — the same normalized map every handler
   * matches against, so `keymap` remaps reflect live and a listed key always
   * actually works. Read-only reference (no rebind UI). Additive; default
   * off (fail-closed).
   */
  shortcutHints?: boolean
  /** Header select-all toggle (additive — not in vxe's emits, batch V): fired with the PRE-toggle header state and the current selection keys. */
  onSelectAllChange?: (state: boolean | 'indeterminate', selection: Array<string | number>) => void
  /** Root scroll (vxe scroll parity, batch V): `{ scrollTop, scrollLeft }` of the root container; fires in column-virtualization mode and via a native listener otherwise (only meaningful with `height`, else overflow is hidden). */
  onScroll?: (params: TableTypes.IrisTableScrollParams) => void
  /** Render an expandable detail panel beneath a row. */
  renderDetail?: TableTypes.IrisTableRenderDetail<Row>
  /** Which rows can expand a detail panel. */
  rowExpandable?: TableTypes.IrisTableRowExpandable<Row>
  /** Initially-expanded row keys (uncontrolled). Shared by detail rows + tree rows. */
  defaultExpandedRowKeys?: Array<string | number>
  /** Expand every tree row that has children on mount (vxe expand-config
   * expandAll parity). One-shot: seeds the expansion model with all tree keys
   * on the first data arrival (proxy pages load async). Default false. */
  expandAll?: boolean
  /** Notified with the expanded row keys whenever they change (batch BY: also the restore channel for `persistState`'s `expandedKeys` piece — the model commit replays this callback). */
  onExpandedRowsChange?: (keys: Array<string | number>) => void
  /** Detail expand toggle (vxe toggle-row-expand parity): `expanded` is the NEW state after the toggle. */
  onExpandChange?: (row: Row, expanded: boolean) => void
  /** Tree expand toggle (vxe toggle-tree-expand parity): `expanded` is the NEW state after the toggle. */
  onTreeExpandChange?: (row: Row, expanded: boolean) => void
  /** Read a row's child rows to render the table as a tree. */
  getSubRows?: (row: Row) => Row[] | undefined
  /** Lazy tree (vxe lazyLoad parity): a row with no `getSubRows` children still renders a caret; the first expand calls this and `load` resolves the children (expanding the row). */
  lazyLoad?: (row: Row, load: (children: Row[]) => void) => void
  /** Batch CL (iris 独有 — vxe has no expand animation):
   * animate detail-panel and tree-row expansion with a max-height + opacity
   * enter transition (token-driven — `--iris-table-expand-max` cap and
   * `--iris-duration-md` duration, both with fallbacks;
   * `prefers-reduced-motion: reduce` turns the animation off entirely).
   * Pure CSS entrance — zero state/effect; root tree rows (depth 0) stay
   * static. Inert in virtual mode (lazy slots would replay the animation on
   * scroll-mount). Additive; default off (fail-closed).
   */
  expandAnimation?: boolean
  /**
   * Enable WAI-ARIA grid keyboard navigation (single-tabstop roving cell
   * focus). Arrow keys move one cell; Home/End jump to the row's first/last
   * cell; PageUp/PageDown jump 10 rows (clamped; virtual tables also scroll
   * the viewport ±10 × row height); Tab/Shift+Tab move row-major to the
   * next/prev cell (clamped at the bounds — no wrap, focus never leaves the
   * table); Enter is an alias of ArrowDown (F2 stays the edit-start key).
   * While an inline editor is open the editor's own keys win — Tab commits
   * and moves to the next editable column (batch J), unchanged.
   */
  keyboardNavigation?: boolean
  /** Batch AN shortcuts (iris 独有 — vxe keyboardConfig has no edit/clear
   * keys): F2 begins editing the focused cell's column (when editable),
   * Delete/Backspace clears it to `''` — one batched `commitRowList`
   * (undo-covered via the undo funnel). Requires `keyboardNavigation`'s
   * focused-cell state (single-tabstop roving cell focus); without it the
   * shortcuts are inert. While an inline editor is open the editor's own
   * keys win. Additive — default off. */
  tableShortcuts?: boolean
  /** Batch DR (iris 独有): edit keys for the focused editable cell. F2 is
   * always included when this prop is present; Enter and Space extend it. */
  editKeys?: Array<'F2' | 'Enter' | 'Space'>
  /** Batch BG (iris 独有 — vxe keyboardConfig has no rebinding): rebind the
   * built-in shortcut keys. ONE key spec string per action
   * (`Modifier+Key`, case-insensitive; `Ctrl`/`Cmd`/`Meta` share one
   * ctrl-or-meta flag — `Ctrl+C` matches Ctrl OR Cmd). Actions:
   * `edit` (default F2) / `clear` (Delete, Backspace) need `tableShortcuts`;
   * `undo` (Ctrl+Z) / `redo` (Ctrl+Y, Ctrl+Shift+Z) need `undo`;
   * `copy` (Ctrl+C) / `paste` (Ctrl+V) need `clipConfig`;
   * `fill` (Ctrl+D — one-step drag-down) needs `rangeFill` + a live range;
   * `query` (Ctrl+K — focuses the query input) needs the controlled `query`.
   * An override REPLACES that action's bindings wholesale (aliases included);
   * invalid specs (`''` / `'Meta'` / `'Ctrl+'` …) are dropped fail-closed —
   * the action keeps its default. Modifiers match exactly: `Ctrl+Shift+Z`
   * redoes, `Alt+Ctrl+Z` is inert. Additive — default off (defaults unchanged). */
  keymap?: Partial<Record<Core.IrisTableKeyAction, string>>
  /** Batch DJ (iris 独有 — vxe keyboardConfig has no focus gate): shortcut
   * scope for the table's WINDOW keydown listeners (undo/redo, clip
   * copy/paste, fnr Ctrl+F + Escape, batch-edit Escape). `hotkeyScope`
   * (default `true`) gates the shortcuts to fire only while the focus is
   * INSIDE the table (`rootRef.contains(e.target)` — the focused element,
   * read live from the keydown target, no extra focus/blur state). Set it to
   * `false` for the permissive compatibility mode where the same bindings
   * fire regardless of where the focus is. `outerScope` (default `false`)
   * forces the GLOBAL scope (fire from anywhere) and wins over
   * `hotkeyScope`. Fail-closed by default: fnr/batch-edit tighten from
   * anywhere → in-table; undo/clip keep their existing in-table behavior. */
  hotkeyScope?: boolean
  /** Force GLOBAL shortcut scope (fire from anywhere, ignoring
   * `hotkeyScope`). Default `false`. */
  outerScope?: boolean
  /** Batch BS (iris 独有 — vxe group-config has no multi-column grouping): table-level NESTED multi-column grouping. Array elements are leaf column `key`s; their order defines the nesting levels (`['dept','status']` → `dept` level 0 → `status` level 1). Every level renders its own collapsible group header (indented by depth, `data-iris-group-depth`); a parent group's count is the subtree row total; the per-group summary row (`summary` ops) appears only on the innermost level. Composite group keys join the level values with `::` (`data-iris-group-key`), so `groupCollapsed`/`defaultGroupCollapsed` address nested groups directly (`'Engineering::Active'`) and a collapsed parent hides its whole subtree. When set, the array WINS over any column-level `groupBy: true` flag; absent/empty/unknown-only → the single-column batch M/BH path runs byte-identical (the array's level-0 fallback). Unknown keys are dropped, duplicates keep the first occurrence. Inert in tree mode (fail-closed, like column grouping). */
  groupBy?: string[]
  /** Batch BH (iris 独有 — vxe group-config has no collapse): controlled set of
   * collapsed group keys. Keys are `String(cell value)` of the `groupBy` column —
   * the same identity `data-iris-group-key` carries. When set, the rendered body
   * only changes after the parent writes the prop back (no optimistic flip).
   * Inert without `groupBy` / in tree mode. */
  groupCollapsed?: Array<string | number>
  /** Default collapsed group keys (uncontrolled mode). */
  defaultGroupCollapsed?: Array<string | number>
  /** Fired on every group-header toggle with the next collapsed keys, in BOTH
   * controlled and uncontrolled modes (lift-ready). */
  onGroupCollapseChange?: (next: Array<string | number>) => void
  /** Enable virtual scrolling for the body. */
  virtualScroll?: TableTypes.IrisTableVirtualOptions
  /** Per-row height (batch BN, iris 独有 — vxe row-height is a fixed config value). Number → uniform height (overrides the default AND `virtualScroll.itemHeight` in virtual mode); `(index) => number` → per-row heights — in virtual mode the fn feeds the variable-height virtualizer (virtual PLAN index, prefix-sum offsets, like `virtualScroll.itemHeight`), otherwise each body row gets its inline height (bodyData index). `rowStyle` stays the per-row escape hatch (it wins). */
  rowHeight?: number | ((index: number) => number)
  /** Persist view state across remounts (batch AG, iris 独有 — vxe has no built-in persistence). Loads sort / multiSortState / filters / filterValues / columnVisibility / columnOrder / columnWidths / pageSize / expandedKeys on mount (replayed through the matching change callbacks) and saves the CURRENT props on every change (the table is controlled). pageSize is only meaningful with proxyConfig.onPageChange (restored via onPageChange(1, restored) before the first query); expandedKeys (batch BY) needs onExpandedRowsChange + an expandable table (renderDetail or tree) — restored through the expansion model, which replays the callback (full-set replace); storage: false fully disables persistence (no reads, no writes); default key 'iris-table-state'. */
  persistState?: TableTypes.IrisTablePersistConfig
  /** Batch DM (iris 独有): periodically persist the complete exported view
   * state to a separate storage key and restore it once on mount. */
  autoSaveState?: TableTypes.IrisTableAutoSaveStateConfig
}
