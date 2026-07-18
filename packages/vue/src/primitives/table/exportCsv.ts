import { saveFile } from '@iris-ui/core'
import type { IrisTableColumn } from './types'

/**
 * OWASP CSV-injection mitigation: a cell whose text a spreadsheet could parse
 * as a formula (leading `=`, `+`, `-`, `@`, or a tab/CR that shifts the first
 * significant character) is prefixed with a single quote so it imports as
 * literal text instead of executing (DDE, `=HYPERLINK`, `=cmd|…`). Numbers
 * (typed at the call site, not string-ish) never carry a formula payload.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/
function neutralizeFormula(text: string): string {
  return FORMULA_LEAD.test(text) ? `'${text}` : text
}

/** Quote a single CSV field per RFC 4180. */
function csvCell(value: unknown): string {
  if (value == null) return ''
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  const s = isNumber ? String(value) : neutralizeFormula(String(value))
  // Quote if the value contains comma, quote, newline, carriage return.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Serialize a list of rows as a CSV string. Columns determine the order;
 * each cell value is read via `dataIndex` (defaulting to the column key).
 *
 * Returns a plain string without BOM. For Excel compatibility with non-ASCII
 * characters, prepend the U+FEFF BOM before writing — `downloadCsv` does this.
 */
export function exportCsv<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
): string {
  const header = columns.map((c) => csvCell(c.title)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const key = (col.dataIndex ?? col.key) as keyof Row
          return csvCell(row[key])
        })
        .join(','),
    )
    .join('\n')
  return body.length > 0 ? `${header}\n${body}` : header
}

/**
 * Trigger a download of the given CSV string. A host `FileSaveHandler` (set via
 * `setFileSaveHandler`) intercepts it for native save in desktop/mobile shells;
 * otherwise falls back to the browser `<a download>`. SSR-safe (no-op without
 * `document`).
 */
export async function downloadCsv(filename: string, csv: string): Promise<void> {
  // Prepend U+FEFF BOM so Excel reads UTF-8 correctly.
  const BOM = String.fromCharCode(0xfeff)
  const content = BOM + csv
  if (await saveFile({ filename, content, mimeType: 'text/csv;charset=utf-8;' })) return
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Defer revoke so click handler can finish.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
