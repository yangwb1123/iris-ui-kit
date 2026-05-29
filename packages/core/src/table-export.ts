/**
 * Framework-agnostic tabular export. `toSpreadsheetXml` emits SpreadsheetML
 * 2003 (the `<?mso-application?>` XML dialect) — opened natively by Excel and
 * LibreOffice with zero dependencies and no ZIP/binary handling, so it's the
 * pragmatic "Excel export" for the Table. Adapters wrap it as `exportExcel`.
 */

/** Minimal column shape needed to serialize a row set. */
export interface TableExportColumn {
  key: string
  title: string
  /** Field to read from each row; defaults to `key`. */
  dataIndex?: string
}

export interface SpreadsheetXmlOptions {
  /** Worksheet tab name. Default `'Sheet1'`. */
  sheetName?: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cell(value: unknown): string {
  if (value == null) return '<Cell><Data ss:Type="String"></Data></Cell>'
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  const type = isNumber ? 'Number' : 'String'
  const text = isNumber ? String(value) : escapeXml(String(value))
  return `<Cell><Data ss:Type="${type}">${text}</Data></Cell>`
}

/**
 * Serialize rows to a SpreadsheetML XML string. Column order sets field order;
 * values are read via `dataIndex` (falling back to `key`). Numeric cells get
 * `ss:Type="Number"` so Excel treats them as numbers, not text.
 */
export function toSpreadsheetXml(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableExportColumn[],
  options: SpreadsheetXmlOptions = {},
): string {
  const sheetName = escapeXml(options.sheetName ?? 'Sheet1')
  const headerRow = `<Row>${columns.map((c) => cell(c.title)).join('')}</Row>`
  const bodyRows = rows
    .map((row) => `<Row>${columns.map((c) => cell(row[c.dataIndex ?? c.key])).join('')}</Row>`)
    .join('')
  return (
    '<?xml version="1.0"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    `<Worksheet ss:Name="${sheetName}"><Table>${headerRow}${bodyRows}</Table></Worksheet>` +
    '</Workbook>'
  )
}
