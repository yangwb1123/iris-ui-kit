import { downloadFile, toSpreadsheetXml, type SpreadsheetXmlOptions } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/** Serialize rows as dependency-free SpreadsheetML. */
export function exportExcel<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
  options?: SpreadsheetXmlOptions,
): string {
  return toSpreadsheetXml(
    rows as readonly Record<string, unknown>[],
    columns.map((column) => ({
      key: column.key,
      title: column.title,
      dataIndex: typeof column.dataIndex === 'string' ? column.dataIndex : undefined,
    })),
    options,
  )
}

/** Save through a native host bridge, falling back to an SSR-safe web download. */
export async function downloadExcel(filename: string, xml: string): Promise<void> {
  await downloadFile({
    filename,
    content: xml,
    mimeType: 'application/vnd.ms-excel;charset=utf-8',
  })
}
