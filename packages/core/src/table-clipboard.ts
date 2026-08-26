import { copyText } from './clipboard'
import { maskValue, type MaskKind } from './mask'
import { toHtml, type TableExportColumn } from './table-export'

export type TableCopyFormat = 'tsv' | 'csv' | 'html'

export interface TableClipboardColumn<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  key: string
  title: string
  dataIndex?: keyof Row | string
  mask?: MaskKind | ((value: unknown) => string)
  exportRaw?: boolean
  formatter?: (value: unknown, row: Row) => unknown
}

export interface TableClipboardRange {
  start: { row: number; col: number }
  end: { row: number; col: number }
}

export type TableClipboardValueResolver<
  Row extends Record<string, unknown> = Record<string, unknown>,
> = (row: Row, column: TableClipboardColumn<Row>) => unknown

const FORMULA_LEAD = /^[=+\-@\t\r]/

/** Apply the table's display mask before a formatter, matching the React table contract. */
export function applyTableMask<Row extends Record<string, unknown>>(
  value: unknown,
  column: TableClipboardColumn<Row>,
): unknown {
  if (column.mask === 'sensitive') return maskValue(value, 'sensitive')
  if (typeof column.mask === 'function') return column.mask(value)
  return value
}

/** Resolve one raw table value without imposing a framework-specific column type. */
export function resolveTableValue<Row extends Record<string, unknown>>(
  row: Row,
  column: TableClipboardColumn<Row>,
): unknown {
  return row[(column.dataIndex ?? column.key) as keyof Row]
}

/** The safe display string used by copyWithFormat: mask → formatter → String. */
export function tableDisplayText<Row extends Record<string, unknown>>(
  row: Row,
  column: TableClipboardColumn<Row>,
  resolveValue: (row: Row, column: TableClipboardColumn<Row>) => unknown = resolveTableValue,
): string {
  const masked = applyTableMask(resolveValue(row, column), column)
  if (column.formatter) {
    const formatted = column.formatter(masked, row)
    if (typeof formatted === 'string') return formatted
  }
  return String(masked ?? '')
}

function safeCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (typeof value === 'number' && Number.isFinite(value)) return text
  return FORMULA_LEAD.test(text) ? `'${text}` : text
}

function csvCell(value: unknown): string {
  const text = safeCell(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function normalizedFormat(format: unknown): TableCopyFormat {
  return format === 'csv' || format === 'html' ? format : 'tsv'
}

/** Serialize the currently selected rectangle; ranges are headerless except for HTML. */
export function serializeTableRange<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly TableClipboardColumn<Row>[],
  range: TableClipboardRange,
  format: unknown = 'tsv',
  copyWithFormat = false,
  resolveValue: TableClipboardValueResolver<Row> = resolveTableValue,
): string {
  const startRow = Math.min(range.start.row, range.end.row)
  const endRow = Math.max(range.start.row, range.end.row)
  const startCol = Math.min(range.start.col, range.end.col)
  const endCol = Math.max(range.start.col, range.end.col)
  const selected = columns.slice(startCol, endCol + 1)
  const outputFormat = normalizedFormat(format)
  if (outputFormat === 'html') {
    const htmlColumns: TableExportColumn[] = selected.map((column) => ({
      key: column.key,
      title: column.title,
      dataIndex: typeof column.dataIndex === 'string' ? column.dataIndex : undefined,
    }))
    const htmlRows = [] as Array<Record<string, unknown>>
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      const row = rows[rowIndex]
      const output: Record<string, unknown> = {}
      for (const column of selected) {
        if (!row) continue
        const raw = resolveValue(row, column)
        output[typeof column.dataIndex === 'string' ? column.dataIndex : column.key] =
          copyWithFormat && column.formatter
            ? tableDisplayText(row, column, resolveValue)
            : column.exportRaw
              ? raw
              : applyTableMask(raw, column)
      }
      htmlRows.push(output)
    }
    return toHtml(htmlRows, htmlColumns)
  }
  const lines: string[] = []
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = rows[rowIndex]
    const cells = selected.map((column) => {
      if (!row) return ''
      const raw = resolveValue(row, column)
      const value =
        copyWithFormat && column.formatter
          ? tableDisplayText(row, column, resolveValue)
          : column.exportRaw
            ? raw
            : applyTableMask(raw, column)
      return outputFormat === 'csv' ? csvCell(value) : safeCell(value)
    })
    lines.push(cells.join(outputFormat === 'csv' ? ',' : '\t'))
  }
  return lines.join('\n')
}

/** Best-effort browser/host clipboard writer; safe no-op in SSR and denied contexts. */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (await copyText(text)) return true
  const runtime = globalThis as typeof globalThis & {
    navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } }
    document?: {
      body?: { appendChild: (node: unknown) => void }
      createElement: (tag: string) => {
        value: string
        setAttribute: (name: string, value: string) => void
        style: { position: string; opacity: string }
        select: () => void
        remove: () => void
      }
      execCommand?: (command: string) => boolean
    }
  }
  if (runtime.navigator) {
    const nav = runtime.navigator
    if (nav.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text)
        return true
      } catch {
        // Continue to the legacy path.
      }
    }
  }
  const document = runtime.document
  if (!document?.body) return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let copied = false
  try {
    copied = document.execCommand?.('copy') ?? false
  } catch {
    // Clipboard access is optional.
  }
  textarea.remove()
  return copied
}
