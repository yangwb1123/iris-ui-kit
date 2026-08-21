import { downloadFile, parseCsv, toCsv } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

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
  return toCsv(
    rows as readonly Record<string, unknown>[],
    columns.map((column) => ({
      key: column.key,
      title: column.title,
      dataIndex: typeof column.dataIndex === 'string' ? column.dataIndex : undefined,
    })),
  )
}

/** Parse RFC-4180 CSV with quoted commas/newlines using the shared core parser. */
export { parseCsv }

/**
 * Trigger a download of the given CSV string. A host `FileSaveHandler` (set via
 * `setFileSaveHandler`) intercepts it for native save in desktop/mobile shells;
 * otherwise falls back to the browser `<a download>`. SSR-safe (no-op without
 * `document`).
 */
export async function downloadCsv(filename: string, csv: string): Promise<void> {
  const BOM = String.fromCharCode(0xfeff)
  await downloadFile({
    filename,
    content: BOM + csv,
    mimeType: 'text/csv;charset=utf-8;',
  })
}
