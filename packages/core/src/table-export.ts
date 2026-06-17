/**
 * Framework-agnostic tabular export — an **auxiliary** capability (B-layer):
 * composed onto a table, not part of its core identity, so it lives here as a
 * standalone serializer rather than inside any controller. `toSpreadsheetXml`
 * emits SpreadsheetML 2003 (the `<?mso-application?>` XML dialect) — opened
 * natively by Excel and LibreOffice with zero dependencies; `toCsv` emits
 * RFC-4180 CSV. Adapters/plugins wrap them as `exportExcel` / `exportCsv`.
 */

/** Minimal column shape needed to serialize a row set. */
export interface TableExportColumn {
  key: string
  title: string
  /** Field to read from each row; defaults to `key`. */
  dataIndex?: string
}

/** Quote a CSV field if it contains a comma, quote, CR, or LF (RFC 4180). */
function csvField(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Serialize rows to an RFC-4180 CSV string. Column order sets field order;
 * values are read via `dataIndex` (falling back to `key`). The single source of
 * truth for CSV export across the Table primitives and the ProTable plugin.
 */
export function toCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableExportColumn[],
): string {
  const header = columns.map((c) => csvField(c.title)).join(',')
  const body = rows
    .map((row) => columns.map((c) => csvField(row[c.dataIndex ?? c.key])).join(','))
    .join('\n')
  return body ? `${header}\n${body}` : header
}

/**
 * Serialize rows to a JSON string — an array of objects keyed by each column's
 * `key`, values read via `dataIndex`. The portable, re-importable export format
 * (`toCsv`/`toSpreadsheetXml`'s structured sibling). Pretty-printed by default.
 */
export function toJson(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableExportColumn[],
  options: { pretty?: boolean } = {},
): string {
  const out = rows.map((row) => {
    const obj: Record<string, unknown> = {}
    for (const c of columns) obj[c.key] = row[c.dataIndex ?? c.key]
    return obj
  })
  return JSON.stringify(out, null, options.pretty === false ? undefined : 2)
}

export interface TableHtmlOptions {
  /** Optional `<caption>` text. */
  caption?: string
  /** Right-align numeric cells (print-friendly). Default true. */
  alignNumbers?: boolean
}

/**
 * Serialize rows to an HTML `<table>` string — for print / preview / email.
 * Column titles head the table; numeric cells are right-aligned; all text is
 * HTML-escaped. An adapter can drop this into a fresh window and call
 * `window.print()` for a print-friendly table.
 */
export function toHtml(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableExportColumn[],
  options: TableHtmlOptions = {},
): string {
  const alignNumbers = options.alignNumbers !== false
  const th = columns.map((c) => `<th>${escapeXml(c.title)}</th>`).join('')
  const trs = rows
    .map((row) => {
      const tds = columns
        .map((c) => {
          const v = row[c.dataIndex ?? c.key]
          const numeric = alignNumbers && typeof v === 'number' && Number.isFinite(v)
          const style = numeric ? ' style="text-align:right"' : ''
          return `<td${style}>${v == null ? '' : escapeXml(String(v))}</td>`
        })
        .join('')
      return `<tr>${tds}</tr>`
    })
    .join('')
  const caption = options.caption ? `<caption>${escapeXml(options.caption)}</caption>` : ''
  return `<table>${caption}<thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
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
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    `<Worksheet ss:Name="${sheetName}"><Table>${headerRow}${bodyRows}</Table></Worksheet>` +
    '</Workbook>'
  )
}
