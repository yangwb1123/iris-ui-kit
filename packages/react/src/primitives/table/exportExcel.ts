import { toSpreadsheetXml, type SpreadsheetXmlOptions } from '@iris-ui/core'
import type { IrisTableColumn } from './types'

/**
 * Serialize rows to a SpreadsheetML (Excel/LibreOffice-native) XML string —
 * the dependency-free counterpart to {@link exportCsv}. Column order sets field
 * order; values read via `dataIndex` (defaulting to `key`).
 */
export function exportExcel<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
  options?: SpreadsheetXmlOptions,
): string {
  return toSpreadsheetXml(
    rows as readonly Record<string, unknown>[],
    columns.map((c) => ({
      key: c.key,
      title: c.title,
      dataIndex: typeof c.dataIndex === 'string' ? c.dataIndex : undefined,
    })),
    options,
  )
}

/** Trigger a browser download of the given SpreadsheetML string. SSR-safe. */
export function downloadExcel(filename: string, xml: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
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
