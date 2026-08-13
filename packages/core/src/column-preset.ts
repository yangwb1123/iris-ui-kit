/**
 * Column presets (batch AN, iris 独有): named display defaults a column can
 * opt into — `'money'`, `'progress'`, `'date'`, `'status'`. The factory is
 * FRAMEWORK-NEUTRAL: it operates on a minimal partial column descriptor
 * (`ColumnPresetDescriptor`), never on an adapter's concrete column type, so
 * core stays free of framework imports and every adapter can call it with its
 * own column type (structural typing — the `ColumnAccessor` precedent in
 * `columns.ts`). `applyColumnPreset` returns the SAME generic column type it
 * receives, so a react `IrisTableColumn<Row>` keeps its type with zero casts.
 *
 * Merge semantics: DEFINED-FIELDS-ONLY — the preset fills only the descriptor
 * fields the column leaves `undefined`; user fields always win (a plain
 * spread would let `align: undefined` silently kill the preset default).
 */

export type ColumnPreset = 'date' | 'money' | 'status' | 'progress'

/**
 * The framework-neutral partial column descriptor a preset can fill. Real
 * column types extend it structurally; `formatter` is `unknown` because
 * strictFunctionTypes makes a fixed-arity function type incompatible with
 * adapter formatters of different arity (react's `(value, row) => ReactNode`
 * vs a plain `(value) => string`) — the preset FILLS a `(value) => string`
 * helper (`formatMoney` etc.) and the generic `C` return type carries the
 * adapter's own column type back with zero casts.
 */
export interface ColumnPresetDescriptor {
  /** Display formatter override (preset default; a user formatter wins). */
  formatter?: unknown
  /** Horizontal alignment override. */
  align?: 'left' | 'center' | 'right'
  /** Inline-editor kind override (e.g. `'number'`). */
  editor?: string
  /** Declarative edit-rule list override (user rules win). */
  editRules?: unknown[]
}

/** Format a numeric value as money: 2 fixed decimals + thousands separators.
 * `null`/`undefined` render as '' (matching the raw cell render); non-numeric
 * input passes through as `String(value)`. Locale-neutral by design — core
 * pure helper, a caller formats per-locale if needed. */
export function formatMoney(value: unknown): string {
  if (value == null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  const fixed = n.toFixed(2)
  const sign = fixed.startsWith('-') ? '-' : ''
  const abs = sign ? fixed.slice(1) : fixed
  const [int, dec] = abs.split('.')
  return `${sign}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`
}

/** Format a ratio as a percent string: 0..1 → `${Math.round(v * 100)}%`,
 * anything else keeps the raw value with a `%` suffix (`null`/`undefined` →
 * ''). */
export function formatProgress(value: unknown): string {
  if (value == null) return ''
  const n = Number(value)
  if (!Number.isNaN(n) && n >= 0 && n <= 1) return `${Math.round(n * 100)}%`
  return `${String(value)}%`
}

/** Display a date-ish cell value as plain text: `String(value)` passthrough
 * (`null`/`undefined` → ''). Locale/relative formatting is deliberately the
 * CALLER's job — a preset must stay deterministic (a `Date` renders its
 * default string form). */
export function formatDateValue(value: unknown): string {
  return value == null ? '' : String(value)
}

/** Plain-text UPPERCASE display for status-ish values (no badge coupling —
 * styling stays the caller's). */
export function formatStatus(value: unknown): string {
  return value == null ? '' : String(value).toUpperCase()
}

/** The defaults each preset fills into a column (the defined-fields-only
 * merge in `applyColumnPreset`). The money editor validates the raw input
 * STRING with a numeric pattern — a `{ type: 'number' }` rule would reject
 * every commit because drafts reach validation as strings. */
export const COLUMN_PRESET_DEFAULTS: Record<ColumnPreset, ColumnPresetDescriptor> = {
  money: {
    formatter: formatMoney,
    align: 'right',
    editor: 'number',
    editRules: [{ type: 'pattern', pattern: /^-?\d+(\.\d+)?$/, message: 'Value must be a number' }],
  },
  progress: { formatter: formatProgress, align: 'right' },
  date: { formatter: formatDateValue, align: 'left' },
  status: { formatter: formatStatus, align: 'center' },
}

/** Apply a preset's defaults onto a column — defined-fields-only, user fields
 * win, returns the same column type (a NEW object whenever anything is
 * filled, the input reference otherwise untouched). */
export function applyColumnPreset<C extends ColumnPresetDescriptor>(
  column: C,
  preset: ColumnPreset,
): C {
  const defaults = COLUMN_PRESET_DEFAULTS[preset]
  const next = { ...column } as C
  const target = next as ColumnPresetDescriptor
  if (column.formatter === undefined && defaults.formatter !== undefined) {
    target.formatter = defaults.formatter
  }
  if (column.align === undefined && defaults.align !== undefined) {
    target.align = defaults.align
  }
  if (column.editor === undefined && defaults.editor !== undefined) {
    target.editor = defaults.editor
  }
  if (column.editRules === undefined && defaults.editRules !== undefined) {
    target.editRules = defaults.editRules
  }
  return next
}
