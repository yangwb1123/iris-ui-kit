import { downloadFile, maskValue, parseCsv, toCsv } from '@iris-ui-kit/core'
import type { IrisTableColumn } from './types'

/**
 * Apply a column's mask to a raw cell value (batch AY): `'sensitive'` → the
 * core `maskValue` sensitive rule; a function → its result; no mask → the
 * value unchanged. Shared by the cell display chain (Table.tsx), the export
 * serializer and the clipboard TSV builder so display/export/copy agree.
 */
export function applyCellMask<Row extends Record<string, unknown>>(
  value: unknown,
  column: IrisTableColumn<Row>,
): unknown {
  if (column.mask === 'sensitive') return maskValue(value, 'sensitive')
  if (typeof column.mask === 'function') return column.mask(value)
  return value
}

/**
 * Serialize rows as a CSV string per RFC 4180. Column order determines field
 * order; cell values are read via `dataIndex` (defaulting to the column key).
 * Returns a plain string without BOM.
 *
 * Batch AY: masked-by-default export — a column with `mask` exports the
 * masked value unless it opts out via `exportRaw`. Masking materializes each
 * masked column's value onto a shadow row at the key the serializer reads
 * (string `dataIndex`, else `key`), the batch-AO shadow-row convention;
 * formula columns are already materialized by
 * `withComputedFormulaCells` before this serializer runs, so the mask applies
 * on top. No masks → the input array is returned as-is (reference-preserving).
 */
export function exportCsv<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  columns: readonly IrisTableColumn<Row>[],
): string {
  const maskedCols = columns.filter((c) => c.mask && !c.exportRaw)
  let out: readonly Row[] = rows
  if (maskedCols.length > 0) {
    out = rows.map((row) => {
      let shadow: Row | null = null
      for (const col of maskedCols) {
        // The serializer reads `row[dataIndex]` for string dataIndex, else
        // `row[key]` (numeric dataIndex is dropped by exportCsv's spec) — the
        // shadow write must land on the SAME key or the mask is silently lost.
        const key = (typeof col.dataIndex === 'string' ? col.dataIndex : col.key) as keyof Row
        const next: Row = shadow ?? { ...row }
        ;(next as Record<string, unknown>)[key as string] = applyCellMask(
          (row as Record<string, unknown>)[key as string],
          col,
        )
        shadow = next
      }
      return shadow as Row
    })
  }
  return toCsv(
    out as readonly Record<string, unknown>[],
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
