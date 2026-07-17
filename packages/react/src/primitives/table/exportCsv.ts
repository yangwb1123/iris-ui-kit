import { saveFile } from '@iris-ui/core'
import type { IrisTableColumn } from './types'

function csvCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Serialize rows as a CSV string per RFC 4180. Column order determines field
 * order; cell values are read via `dataIndex` (defaulting to the column key).
 * Returns a plain string without BOM.
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
 * otherwise falls back to the browser `<a download>`. SSR-safe.
 */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = String.fromCharCode(0xfeff)
  const content = BOM + csv
  if (saveFile({ filename, content, mimeType: 'text/csv;charset=utf-8;' })) return
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
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
