import type { IrisTableAggregateOp, IrisTableEditor, IrisTableFilterOption } from './base'

export interface IrisTableColumn<Row = Record<string, unknown>> {
  key: string
  title: string
  /** Icon/content rendered before the header title (vxe title-prefix parity). */
  titlePrefix?: import('react').ReactNode
  /** Icon/content rendered after the header title (vxe title-suffix parity). */
  titleSuffix?: import('react').ReactNode
  /** Path inside the row to read the cell value from. Defaults to `key`. */
  dataIndex?: keyof Row | string
  /**
   * Single-line cell formula (batch AO, iris 独有 — vxe has no computed
   * columns; the closest is a display-only formatter). Evaluated by the core
   * `evaluateFormula` parser against each row: field refs + `+ - * / %` +
   * whitelist functions SUM/AVG/MIN/MAX/COUNT (case-insensitive), optional
   * leading `=`. The COMPUTED value feeds every data consumer — cell render,
   * sorting, filtering, grouping, summary, range stats, clipboard and CSV
   * export. Errors / unknown fields → null (empty cell). An `editable`
   * formula column is DISPLAY-ONLY: inline editing, row mode and batch edit
   * ignore it. Overrides `dataIndex` / `sortBy`. Leading `=` optional.
   */
  formula?: string
  sortable?: boolean
  /** Sort by another field (vxe sort-by parity): the comparator reads this
   * field instead of the column's own value. */
  sortBy?: string
  /** Force the sort type (vxe sort-type parity). Default `'auto'` (numbers
   * compare numerically, everything else as strings). */
  sortType?: 'number' | 'string' | 'auto'
  /** Custom client-side filter (vxe filter-method parity). Return true to
   * keep the row. Overrides the default case-insensitive substring match. */
  filterMethod?: (value: unknown, row: Row, filterValue: string) => boolean
  /** Single-select filter (vxe filter-multiple parity). The current filter
   * UI is value-based (one value per column), so this is the default. */
  filterMultiple?: boolean
  /** Render the cell value as HTML (vxe type=html parity). Opt-in only —
   * the value is injected with `dangerouslySetInnerHTML`; ensure the content
   * is trusted to avoid XSS. */
  html?: boolean
  /** Render the cell value as a link (vxe... no direct parity, batch L): return
   * `{ href, label?, target? }` or a plain href string; `null`/`undefined` falls
   * through to the formatter/raw value. The anchor text is `label` when given,
   * otherwise the formatted (or raw) text; `target: '_blank'` adds `rel="noreferrer"`. */
  link?: (
    value: unknown,
    row: Row,
  ) => { href: string; label?: string; target?: string } | string | null
  width?: number | string
  /** Minimum width (px) when resizing. Default 60. */
  minWidth?: number
  /** Maximum width (px) when resizing. Default Infinity. */
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  /** Freeze this column to an edge during horizontal scroll (position: sticky). */
  pinned?: 'left' | 'right'
  /** Allow double-click inline editing of this column's cells. */
  editable?: boolean
  /** Editor kind. Default `'text'`. */
  editor?: IrisTableEditor
  /**
   * Lock this column's cells against editing (batch BE, iris 独有 — vxe has
   * no cell-lock concept): `true` locks every cell of the column; a
   * predicate receives the row (and column) and returns whether THAT cell is
   * locked — a predicate ignoring its column argument is a row-level lock
   * (both levels share this one field). Locked cells are not editable —
   * every editing entry point no-ops (dblclick / click trigger / F2 / Tab
   * nav / row mode / batch edit / paste / fill / range clear / FNR replace /
   * Delete shortcut) — render with a striped background and
   * `data-iris-cell-locked="true"`, and stay fully interactive for
   * selection, copy and export.
   */
  locked?: boolean | ((row: Row, column: IrisTableColumn<Row>) => boolean)
  /**
   * Cell permission predicate (batch BJ, iris 独有 — vxe has no per-cell
   * permission concept): return `'readonly'` to make THAT cell read-only
   * through every editing entry point (dblclick / click trigger / F2 / Tab
   * nav / row mode / batch edit / paste / fill / range clear / FNR replace /
   * Delete shortcut); `'editable'` or absent → editable (default). DYNAMIC —
   * re-evaluated on every render (unlike `locked`, which is a static
   * declaration): permission follows the current row/column state without a
   * re-mount. Readonly cells render with a dotted texture and
   * `data-iris-cell-readonly="true"` (distinct from locked's 45° stripes),
   * and stay fully interactive for selection, copy and export. When a cell is
   * both locked and readonly, locked wins visually (stripes + not-allowed).
   */
  cellPermission?: (row: Row, column: IrisTableColumn<Row>) => 'readonly' | 'editable'
  /** Batch AN column preset (iris 独有): fills display defaults from the core
   * factory — `'money'` (2 decimals + thousands separator, right-aligned,
   * number editor + numeric editRules), `'progress'` (percent text, right),
   * `'date'` (String passthrough, left), `'status'` (UPPERCASE text, center).
   * User fields always win over the preset defaults (defined-fields-only
   * merge); localized formatting stays the caller's job. */
  preset?: import('@iris-ui-kit/core').ColumnPreset
  /**
   * Native datalist suggestions while editing (batch AM, iris 独有): `true`
   * builds the option list from the DISTINCT cell values of this column over
   * the current body data (String-coerced, null/'' excluded, sorted, capped at
   * 50); an explicit array of `string | number` is used verbatim. Text editor
   * only — the number/select/textarea editors ignore it. */
  suggest?: boolean | Array<string | number>
  /**
   * Options for the `'select'` editor (vxe edit-render options parity). A
   * column with `editor: 'select'` renders a native `<select>` while editing;
   * each option commits its TYPED value — a number option commits a number,
   * a string option a string (matched by `String(value)`). When the current
   * cell value matches no option, a synthetic option preserves it so a plain
   * blur never silently replaces it.
   */
  editOptions?: Array<{ value: string | number; label: string }>
  /**
   * Validate a draft value before it commits. Return an error message to
   * REJECT the edit (the editor stays open, shows the message, and is marked
   * `aria-invalid`); return `null`/`undefined` to accept. Receives the parsed
   * value (a number for the `'number'` editor) and the row being edited.
   */
  validate?: (value: unknown, row: Row) => string | null | undefined
  /**
   * Declarative edit rules (vxe-grid editRules parity) evaluated on commit —
   * `required` / `min` / `max` / `type` / `pattern` / `validator` (sync or
   * async). Rules run first; the legacy `validate` callback runs after.
   */
  editRules?: import('@iris-ui-kit/core').EditRule<Row>[]
  /**
   * Aggregate this column in the table's summary/footer row. Any column with a
   * `summary` op makes the footer row appear; columns without one render blank.
   */
  summary?: IrisTableAggregateOp
  /**
   * Format this column's summary value. Receives the aggregated number and the
   * rows it was computed over; defaults to the number's string form.
   */
  renderSummary?: (value: number, rows: Row[]) => import('react').ReactNode
  /**
   * Child columns, making this a HEADER GROUP that spans them in a multi-level
   * header. A column with `children` is not a data column itself — its leaf
   * descendants render the body. Omit for a normal (leaf) column.
   */
  children?: IrisTableColumn<Row>[]
  /** Custom comparator for sorting; defaults to native `<`. */
  sorter?: (a: Row, b: Row) => number
  /** Custom render for cell content. */
  render?: (value: unknown, row: Row, rowIndex: number) => import('react').ReactNode
  /** Format a cell's value for display (vxe formatter parity, batch I). Applied AFTER
   * `render`/`html` and BEFORE the raw value; sorting, filtering, editing and summary
   * keep reading the RAW value. The tooltip defaults to the formatted text when it is
   * a string. With `clipConfig.copyWithFormat` (batch CU, iris 独有) the range copy
   * (Ctrl/Cmd+C / toolbar 复制) carries this formatted text instead of the raw value. */
  formatter?: (value: unknown, row: Row) => import('react').ReactNode
  /** Mask this column's value for display (batch AY, iris 独有 — vxe has no
   * built-in masking): `'sensitive'` applies the core `maskValue` sensitive
   * rule (email → 11-digit phone → generic); a custom function receives the
   * RAW cell value and returns the masked string. Applied FIRST in the
   * display chain — `render`/`html`/`link`/`formatter`/tooltip all see the
   * masked value (a `formatter` receives the masked STRING); inline editing,
   * validation, sorting, filtering, summary, range stats and conditional
   * styles keep reading the RAW value. Export/copy mask by default unless
   * `exportRaw` is set. */
  mask?: 'sensitive' | ((value: unknown) => string)
  /** Export/copy the RAW value instead of the masked one (batch AY): when
   * true, `exportCsv`/`exportCurrentViewCsv`/`exportSelectionCsv` and the
   * clipboard TSV skip this column's mask. Display keeps masking. */
  exportRaw?: boolean
  /**
   * Render this numeric column's cells as a mini trend line (batch BI, iris
   * 独有 — vxe has no sparkline): each cell shows a 20×8 SVG polyline of the
   * column's values over `filteredData[0..i]` INCLUSIVE (the current value is
   * the final point), so sorting/filtering reorder and trim the series.
   * Only cells whose RAW value is a finite number render an SVG (non-numeric
   * cells render nothing); series points coerce like `buildChartData`
   * (null/non-finite → gap). Wins over `render`/`html`/`link`/`formatter`/
   * raw; mask, editing, copy/export and summary stay untouched. The cell
   * `title` shows the series ("10, 4, 8") instead of the tooltip.
   */
  sparkline?: boolean
  /** Show a header filter trigger + checkbox panel (vxe filterConfig parity, batch I).
   * Filtering OR-matches the raw `String(value)` against the checked set. */
  filterable?: boolean
  /** Checkbox options for the filter panel; a column without options can't filter. */
  filterOptions?: IrisTableFilterOption[]
  /**
   * Group the body by this column's value (vxe group-config parity, batch M):
   * a group header row per distinct value (first-appearance order,
   * `data-iris-group-row`) showing the value + count, then that group's rows,
   * then a per-group summary row (`data-iris-group-summary`, same `summary`
   * ops as the footer computed over the group's rows) when any column has a
   * `summary` op. Flat mode only — tree mode ignores grouping (fail-closed);
   * proxy mode groups per loaded page. Only the first `groupBy` column drives
   * the plan — unless the table-level `groupBy?: string[]` (batch BS) is set,
   * which wins and drives nested multi-column grouping instead. Group headers are collapsible (batch BH, iris 独有): the
   * `data-iris-group-toggle` button collapses the group (rows + per-group
   * summary hidden, header + count stay) via `groupCollapsed` /
   * `defaultGroupCollapsed` / `onGroupCollapseChange`.
   */
  groupBy?: boolean
  /** Hide this column entirely (vxe column visibleMethod parity, batch U): a
   * predicate evaluated in the display-columns memo (at most once per
   * render); `false` hides the column even when `columnVisibility` says
   * visible (the column's own veto wins). Absent / `true` keeps it. Scope
   * mirrors `columnVisibility`: top-level columns only — a grouped column's
   * leaf `visibleMethod` is not consulted (same documented simplification). */
  visibleMethod?: () => boolean
}
