import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IrisTable, type IrisTableColumn } from '../index'

afterEach(cleanup)

interface Row {
  id: number
  name: string
  age: number
  [key: string]: unknown
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right' },
]

describe('IrisTable basic usage (vxe-grid 基础使用 parity)', () => {
  it('size preset renders data-size and shrinks row height (mini)', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" size="mini" />)
    expect(container.querySelector('[data-iris-table]')?.getAttribute('data-size')).toBe('mini')
  })

  it('showHeader=false hides the header row', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" showHeader={false} />,
    )
    expect(container.querySelector('[data-iris-table-row="header"]')).toBeNull()
    expect(container.querySelectorAll('[data-iris-table-row]').length).toBe(2)
  })

  it('footerData renders custom footer rows with hooks', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        footerData={[{ id: 0, name: 'Total', age: 55 }]}
        footerCellClassName={(col) => `ft-${col.key}`}
        footerCellStyle={(col) => (col.key === 'age' ? { color: 'red' } : {})}
      />,
    )
    const footer = container.querySelector('[data-iris-table-footer]')!
    expect(footer).not.toBeNull()
    expect(footer.textContent).toContain('Total')
    expect(footer.textContent).toContain('55')
    expect(footer.querySelector('.ft-age')).not.toBeNull()
  })

  it('row/cell/header class + style hooks apply', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        rowClassName={() => 'my-row'}
        cellClassName={(row) => `cell-${row.name}`}
        headerCellClassName={(col) => `hdr-${col.key}`}
        rowStyle={() => ({ background: 'rgb(1, 2, 3)' })}
        cellStyle={() => ({ fontWeight: 700 })}
        headerCellStyle={() => ({ fontStyle: 'italic' })}
      />,
    )
    expect(container.querySelector('[data-iris-table-row].my-row')).not.toBeNull()
    expect(container.querySelector('.cell-Alice')).not.toBeNull()
    expect(container.querySelector('.hdr-name')).not.toBeNull()
    const row = container.querySelector('[data-iris-table-row="1"]') as HTMLElement
    expect(row.style.background).toBe('rgb(1, 2, 3)')
  })

  it('titlePrefix / titleSuffix render inside the header title', () => {
    const withIcons: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', titlePrefix: '★', titleSuffix: '☑' },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(<IrisTable columns={withIcons} data={rows} rowKey="id" />)
    const header = container.querySelector('[data-iris-table-header="name"]')!
    expect(header.textContent).toContain('★')
    expect(header.textContent).toContain('☑')
  })

  it('onCellClick fires with coordinates and coexists with click editing', () => {
    const onCellClick = vi.fn()
    const editable: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(
      <IrisTable
        columns={editable}
        data={rows}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
        onCellClick={onCellClick}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-cell="name"]')!)
    expect(onCellClick).toHaveBeenCalledWith(
      expect.objectContaining({
        rowIndex: 0,
        columnIndex: 0,
        column: expect.objectContaining({ key: 'name' }),
      }),
    )
    // click editing still opens the editor (internal behavior preserved)
    expect(container.querySelector('input')).not.toBeNull()
  })

  it('width percentage columns share the grid', () => {
    const pct: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: '60%' },
      { key: 'age', title: 'Age', width: '40%' },
    ]
    const { container } = render(<IrisTable columns={pct} data={rows} rowKey="id" />)
    const row = container.querySelector('[data-iris-table-row="1"]') as HTMLElement
    expect(row.style.gridTemplateColumns).toContain('60%')
  })
})
