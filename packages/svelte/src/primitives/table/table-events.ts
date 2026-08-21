export function handleTableRowKeyDown(
  event: KeyboardEvent,
  row: Record<string, unknown>,
  index: number,
  onRowClick?: (row: Record<string, unknown>, index: number) => void,
): void {
  if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  onRowClick(row, index)
}
