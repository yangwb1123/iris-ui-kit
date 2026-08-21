import { downloadFile, parseCsv, toCsv } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/** Serialize rows as RFC-4180 CSV using the shared core implementation. */
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

/** Save through a native host bridge, falling back to an SSR-safe web download. */
export async function downloadCsv(filename: string, csv: string): Promise<void> {
  await downloadFile({
    filename,
    content: String.fromCharCode(0xfeff) + csv,
    mimeType: 'text/csv;charset=utf-8;',
  })
}
