/**
 * Framework-agnostic conditional formatting (batch AX, iris 独有 — vxe has no
 * built-in conditional-formatting engine; its closest analog is hand-writing
 * per-cell `cell-style` callbacks that re-implement the same predicate loop
 * for every table). Applies an ordered list of rules to ONE cell: a rule
 * matches when its optional `column` filter (omitted → every column) equals
 * the cell's column key AND its `when` predicate returns true for the raw
 * cell value. Matching rules merge in array order — later matches win on
 * conflicting keys, the same spread-order latitude the adapter's `cellStyle`
 * hook already has.
 *
 * The `value` passed to `when` is the RAW cell value (the same `getCellValue`
 * indirection the table uses: `dataIndex ?? key` resolved, formula columns
 * computed), so rules read exactly what the cell renders. The function is
 * pure and side-effect free: it never mutates `rules`, `row` or the rule
 * styles, and returns a fresh object each call (`{}` when nothing matches).
 */

/** One conditional-formatting rule (batch AX, iris 独有). */
export interface ConditionalStyleRule<
  Row = Record<string, unknown>,
  Style = Record<string, string | number | undefined>,
> {
  /** Column key this rule applies to; omitted → every column. */
  column?: string
  /** Match predicate: `row` is the full row object, `value` the raw cell
   * value (dataIndex ?? key resolved, formula columns computed). */
  when: (row: Row, value: unknown) => boolean
  /** Inline styles merged onto the cell when the rule matches. Framework-free
   * object; adapters bridge their CSSProperties type here via `Style`. */
  style: Style
}

/**
 * Apply conditional-formatting rules to one cell, returning the merged inline
 * style object (`{}` when nothing matches). Rules are evaluated in array
 * order and later matching rules override earlier ones on conflicting keys.
 */
export function matchConditionalStyles<
  Row extends Record<string, unknown>,
  Style = Record<string, string | number | undefined>,
>(
  rules: readonly ConditionalStyleRule<Row, Style>[],
  row: Row,
  columnKey: string,
  value: unknown,
): Style {
  let merged: Style | undefined
  for (const rule of rules) {
    if (rule.column !== undefined && rule.column !== columnKey) continue
    if (!rule.when(row, value)) continue
    merged = { ...(merged ?? ({} as Style)), ...rule.style }
  }
  return merged ?? ({} as Style)
}
