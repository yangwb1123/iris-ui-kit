import type { IrisTableColumn } from './types'

/** Quote a single CSV field per RFC 4180. */
function csvCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
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
 * Trigger a browser download of the given CSV string. SSR-safe (no-op
 * without `document`).
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return
  // Prepend U+FEFF BOM so Excel reads UTF-8 correctly.
  const BOM = String.fromCharCode(0xfeff)
  const blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8;' })
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
