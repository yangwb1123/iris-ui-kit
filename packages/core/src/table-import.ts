import { parseCsv } from './table-export'

/**
 * Convert an RFC-4180 CSV payload into row objects using the first record as
 * the header. Header-only and empty payloads intentionally return an empty
 * list so callers can keep their import path fail-closed.
 */
export function rowsFromCsv(text: string): Array<Record<string, string>> {
  const records = parseCsv(text)
  if (records.length < 2) return []
  const [header, ...body] = records
  return body.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])),
  )
}

/** Return the stable preview column order from the first parsed row. */
export function previewColumnsFromRows(
  rows: readonly Record<string, unknown>[] | null | undefined,
): string[] {
  return rows && rows.length > 0 ? Object.keys(rows[0]) : []
}
