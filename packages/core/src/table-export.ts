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

/**
 * OWASP CSV-injection mitigation. A cell whose text a spreadsheet could parse
 * as a formula — one leading with `=`, `+`, `-`, `@`, or a tab/line break that shifts
 * the first significant character — is prefixed with a single quote so the
 * spreadsheet imports it as literal text instead of executing it (DDE,
 * `HYPERLINK`, `=cmd|…`). Applied to string-ish values only; real numbers
 * (typed `Number` on export) cannot carry a formula payload and must not be
 * mangled (a numeric `-5` stays `-5`, not `'-5`).
 */
const FORMULA_LEAD = /^[=+\-@\t\r\n]/
function neutralizeFormula(text: string): string {
  return FORMULA_LEAD.test(text) ? `'${text}` : text
}

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

function ownValue(value: unknown, key: string): unknown {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return undefined
  }
  return hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined
}

interface NormalizedTableExportColumn {
  key: string
  title: string
  dataIndex: string
}

/** Ignore malformed runtime columns rather than reading inherited properties. */
function normalizeColumns(columns: unknown): NormalizedTableExportColumn[] {
  if (!Array.isArray(columns)) return []
  const normalized: NormalizedTableExportColumn[] = []
  for (const column of columns) {
    const key = ownValue(column, 'key')
    const title = ownValue(column, 'title')
    if (typeof key !== 'string' || typeof title !== 'string') continue
    const dataIndex = ownValue(column, 'dataIndex')
    normalized.push({
      key,
      title,
      dataIndex: typeof dataIndex === 'string' ? dataIndex : key,
    })
  }
  return normalized
}

function readCell(row: unknown, key: string): unknown {
  return ownValue(row, key)
}

/** Quote a CSV field if it contains a comma, quote, CR, or LF (RFC 4180). */
function csvField(value: unknown): string {
  if (value == null) return ''
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  const text = isNumber ? String(value) : neutralizeFormula(String(value))
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
  const normalizedColumns = normalizeColumns(columns)
  const safeRows = Array.isArray(rows) ? rows : []
  const header = normalizedColumns.map((c) => csvField(c.title)).join(',')
  const body = safeRows
    .map((row) => normalizedColumns.map((c) => csvField(readCell(row, c.dataIndex))).join(','))
    .join('\n')
  return body ? `${header}\n${body}` : header
}

/** Serialize a bare referenced row set by its own enumerable schema. The
 * first row's key order becomes the header; an empty set has no segment body. */
export function toCsvRows(rows: readonly Record<string, unknown>[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const firstRow = rows[0]
  if (firstRow === null || (typeof firstRow !== 'object' && typeof firstRow !== 'function')) {
    return ''
  }
  const keys = Object.keys(firstRow)
  return toCsv(
    rows,
    keys.map((key) => ({ key, title: key })),
  )
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
  const normalizedColumns = normalizeColumns(columns)
  const safeRows = Array.isArray(rows) ? rows : []
  const out = safeRows.map((row) => {
    // A null-prototype object keeps a column literally named "__proto__" as
    // data instead of invoking Object.prototype's legacy setter.
    const obj: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const c of normalizedColumns) obj[c.key] = readCell(row, c.dataIndex)
    return obj
  })
  return JSON.stringify(out, null, options && options.pretty === false ? undefined : 2)
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
  const normalizedColumns = normalizeColumns(columns)
  const safeRows = Array.isArray(rows) ? rows : []
  const alignNumbers = ownValue(options, 'alignNumbers') !== false
  const th = normalizedColumns.map((c) => `<th>${escapeXml(c.title)}</th>`).join('')
  const trs = safeRows
    .map((row) => {
      const tds = normalizedColumns
        .map((c) => {
          const v = readCell(row, c.dataIndex)
          const numeric = alignNumbers && typeof v === 'number' && Number.isFinite(v)
          const style = numeric ? ' style="text-align:right"' : ''
          return `<td${style}>${v == null ? '' : escapeXml(String(v))}</td>`
        })
        .join('')
      return `<tr>${tds}</tr>`
    })
    .join('')
  const captionValue = ownValue(options, 'caption')
  const caption = captionValue ? `<caption>${escapeXml(String(captionValue))}</caption>` : ''
  return `<table>${caption}<thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}

export interface SpreadsheetXmlOptions {
  /** Worksheet tab name. Default `'Sheet1'`. */
  sheetName?: string
  /**
   * Emit a `<Styles>` block with a bold font and apply it to the header row
   * cells (`ss:StyleID="Header"`). Default false (style-less output).
   */
  headerStyle?: boolean
  /**
   * Column widths in characters (Excel's display unit; converted to points at
   * 5.25pt/char). Values are clamped to the column count; non-finite or
   * non-positive entries are skipped (the column keeps its default width).
   */
  columnWidths?: number[]
}

function stripXmlInvalidControls(value: string): string {
  let clean = ''
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0xfffe ||
      code === 0xffff
    ) {
      continue
    }
    clean += character
  }
  return clean
}

function escapeXml(value: string): string {
  // XML 1.0 rejects these control characters even when entity-escaped.
  return stripXmlInvalidControls(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cell(value: unknown, styleId?: string): string {
  const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : ''
  if (value == null) return `<Cell${styleAttr}><Data ss:Type="String"></Data></Cell>`
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  const type = isNumber ? 'Number' : 'String'
  const text = isNumber ? String(value) : escapeXml(neutralizeFormula(String(value)))
  return `<Cell${styleAttr}><Data ss:Type="${type}">${text}</Data></Cell>`
}

/**
 * Serialize `columnWidths` (characters → points at 5.25pt/char) as
 * `<Column ss:Width>` elements, clamped to the column count. Empty when the
 * option is absent — style-less/width-less output stays byte-identical.
 */
function columnWidthsXml(widths: number[] | undefined, columnCount: number): string {
  if (!widths) return ''
  const cols: string[] = []
  for (let i = 0; i < Math.min(widths.length, columnCount); i += 1) {
    const chars = widths[i]
    if (typeof chars === 'number' && Number.isFinite(chars) && chars > 0) {
      const points = chars * 5.25
      const rounded = Math.round(points * 100) / 100
      if (Number.isFinite(rounded) && rounded > 0) {
        cols.push(`<Column ss:Width="${rounded}"/>`)
      }
    }
  }
  return cols.join('')
}

/**
 * Serialize rows to a SpreadsheetML XML string. Column order sets field order;
 * values are read via `dataIndex` (falling back to `key`). Numeric cells get
 * `ss:Type="Number"` so Excel treats them as numbers, not text. Optional
 * `headerStyle`/`columnWidths` add a bold header style and `<Column>` widths
 * (see {@link SpreadsheetXmlOptions}).
 */
export function toSpreadsheetXml(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableExportColumn[],
  options: SpreadsheetXmlOptions = {},
): string {
  const normalizedColumns = normalizeColumns(columns)
  const safeRows = Array.isArray(rows) ? rows : []
  const sheetNameOption = ownValue(options, 'sheetName')
  const sheetName = escapeXml(typeof sheetNameOption === 'string' ? sheetNameOption : 'Sheet1')
  const headerStyle = ownValue(options, 'headerStyle') === true
  const headerCell = (title: string) => cell(title, headerStyle ? 'Header' : undefined)
  const headerRow = `<Row>${normalizedColumns.map((c) => headerCell(c.title)).join('')}</Row>`
  const bodyRows = safeRows
    .map(
      (row) =>
        `<Row>${normalizedColumns.map((c) => cell(readCell(row, c.dataIndex))).join('')}</Row>`,
    )
    .join('')
  const styles = headerStyle
    ? '<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>'
    : ''
  const columnWidths = ownValue(options, 'columnWidths')
  const cols = columnWidthsXml(
    Array.isArray(columnWidths) ? columnWidths : undefined,
    normalizedColumns.length,
  )
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    styles +
    `<Worksheet ss:Name="${sheetName}"><Table>${cols}${headerRow}${bodyRows}</Table></Worksheet>` +
    '</Workbook>'
  )
}

/**
 * Parse CSV text into rows (inverse of `toCsv`). Handles quoted fields with
 * embedded commas/quotes/newlines, per RFC 4180. Malformed input fails closed
 * as an empty result instead of silently dropping quote characters.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let afterClosingQuote = false
  // downloadCsv prepends a BOM. Strip only a leading BOM so it cannot become
  // part of the first header, while preserving all other cell characters.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
          afterClosingQuote = true
        }
      } else {
        // Preserve CR/LF inside quoted fields for an exact serializer round trip.
        field += ch
      }
    } else if (afterClosingQuote) {
      if (ch === ',') {
        row.push(field)
        field = ''
        afterClosingQuote = false
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i += 1
        row.push(field)
        rows.push(row)
        row = []
        field = ''
        afterClosingQuote = false
      } else {
        return []
      }
    } else if (ch === '"') {
      // A quote is only valid at the beginning of a field in RFC 4180.
      if (field !== '') return []
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (inQuotes) return []
  if (field !== '' || row.length > 0 || afterClosingQuote) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
