import { downloadFile, toCsv } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/**
 * Serialize rows as a CSV string per RFC 4180. Column order determines field
 * order; cell values are read via `dataIndex` (defaulting to the column key).
 * Returns a plain string without BOM.
 */
export function exportCsv<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
): string {
  return toCsv(
    rows as readonly Record<string, unknown>[],
    columns.map((column) => ({
      key: column.key,
      title: column.title,
      dataIndex: typeof column.dataIndex === 'string' ? column.dataIndex : undefined,
    })),
  )
}

/**
 * Trigger a download of the given CSV string. A host `FileSaveHandler` (set via
 * `setFileSaveHandler`) intercepts it for native save in desktop/mobile shells;
 * otherwise falls back to the browser `<a download>`. SSR-safe.
 */
export async function downloadCsv(filename: string, csv: string): Promise<void> {
  const BOM = String.fromCharCode(0xfeff)
  await downloadFile({
    filename,
    content: BOM + csv,
    mimeType: 'text/csv;charset=utf-8;',
  })
}
