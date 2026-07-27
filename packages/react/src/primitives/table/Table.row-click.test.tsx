import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

it('calls onRowClick with the row and visible index', () => {
  const rows: Row[] = [{ id: 1, name: 'Ada' }]
  const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
  const onRowClick = vi.fn()
  render(<IrisTable columns={columns} data={rows} onRowClick={onRowClick} />)
  fireEvent.click(document.querySelector('[data-iris-table-row="1"]')!)
  expect(onRowClick).toHaveBeenCalledWith(rows[0], 0)
})
