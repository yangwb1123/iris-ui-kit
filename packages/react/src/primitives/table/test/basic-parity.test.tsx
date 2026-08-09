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

describe('IrisTable interaction extras (vxe 排序/筛选/高亮/seq/html parity)', () => {
  it('sortBy sorts by another field', () => {
    const byAge: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sortable: true, sortBy: 'age' },
      { key: 'age', title: 'Age' },
    ]
    const data = [
      { id: 1, name: 'A', age: 40 },
      { id: 2, name: 'B', age: 10 },
    ]
    const { container } = render(
      <IrisTable
        columns={byAge}
        data={data}
        rowKey="id"
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    )
    const cells = [...container.querySelectorAll('[data-iris-table-cell="name"]')].map(
      (c) => c.textContent,
    )
    expect(cells).toEqual(['B', 'A'])
  })

  it('sortType=number compares numerically (string digits)', () => {
    const num: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', sortable: true, sortType: 'number' },
      { key: 'age', title: 'Age' },
    ]
    const data = [
      { id: 1, name: '9', age: 1 },
      { id: 2, name: '10', age: 2 },
    ]
    const { container } = render(
      <IrisTable
        columns={num}
        data={data}
        rowKey="id"
        defaultSort={{ key: 'name', direction: 'asc' }}
      />,
    )
    const cells = [...container.querySelectorAll('[data-iris-table-cell="name"]')].map(
      (c) => c.textContent,
    )
    expect(cells).toEqual(['9', '10'])
  })

  it('filterMethod custom predicate overrides substring match', () => {
    const cols2: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', filterMethod: (v, _r, f) => String(v).length > Number(f) },
      { key: 'age', title: 'Age' },
    ]
    const data = [
      { id: 1, name: 'ab', age: 1 },
      { id: 2, name: 'abcdef', age: 2 },
    ]
    const { container } = render(
      <IrisTable columns={cols2} data={data} rowKey="id" filters={{ name: '3' }} />,
    )
    const names = [...container.querySelectorAll('[data-iris-table-cell="name"]')].map(
      (c) => c.textContent,
    )
    expect(names).toEqual(['abcdef'])
  })

  it('current row/column highlight + veto', () => {
    const onCurrentRowChange = vi.fn()
    const onCurrentColumnChange = vi.fn()
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        currentRowKey={1}
        currentColumnKey="name"
        onCurrentRowChange={onCurrentRowChange}
        onCurrentColumnChange={onCurrentColumnChange}
      />,
    )
    expect(
      container
        .querySelector('[data-iris-row-current="true"]')
        ?.getAttribute('data-iris-table-row'),
    ).toBe('1')
    expect(
      container
        .querySelector('[data-iris-col-current="true"]')
        ?.getAttribute('data-iris-table-header'),
    ).toBe('name')
    fireEvent.click(container.querySelector('[data-iris-table-row="2"]')!)
    expect(onCurrentRowChange).toHaveBeenCalledWith(2, expect.any(Object))
    fireEvent.click(container.querySelector('[data-iris-table-header="age"]')!)
    expect(onCurrentColumnChange).toHaveBeenCalledWith('age')
  })

  it('seqStartIndex and seqMethod customize the sequence column', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" seq seqStartIndex={100} />,
    )
    const seqCells = [...container.querySelectorAll('[data-iris-table-cell="__seq"]')].map(
      (c) => c.textContent,
    )
    expect(seqCells).toEqual(['100', '101'])
    const { container: c2 } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        seq
        seqMethod={({ rowIndex }) => `R${rowIndex + 1}`}
      />,
    )
    expect(c2.querySelector('[data-iris-table-cell="__seq"]')?.textContent).toBe('R1')
  })

  it('html column renders trusted markup', () => {
    const htmlCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', html: true },
      { key: 'age', title: 'Age' },
    ]
    const data = [{ id: 1, name: '<b>Bold</b>', age: 1 }]
    const { container } = render(<IrisTable columns={htmlCols} data={data} rowKey="id" />)
    expect(container.querySelector('[data-iris-table-cell="name"] b')?.textContent).toBe('Bold')
  })
})

describe('IrisTable edit write-back (vxe-grid 编辑数据回写)', () => {
  it('committed edit survives WITHOUT parent re-feeding data', () => {
    const editable: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', editable: true }]
    const data = [{ id: 1, name: 'Alice' }]
    const { container } = render(
      <IrisTable columns={editable} data={data} rowKey="id" editConfig={{ trigger: 'click' }} />,
    )
    // 编辑
    fireEvent.click(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Alicia' } })
    fireEvent.blur(input)
    // 提交后单元格显示新值（没有父组件更新 data！）
    expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Alicia')
    // 原始数据未被改动（不可变）
    expect(data[0]?.name).toBe('Alice')
  })

  it('external data reference change still wins (controlled)', () => {
    const editable: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', editable: true }]
    const { container, rerender } = render(
      <IrisTable
        columns={editable}
        data={[{ id: 1, name: 'Alice' }]}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Alicia' } })
    fireEvent.blur(input)
    // 父组件接管：传新 data 引用 → 显示外部值
    rerender(
      <IrisTable
        columns={editable}
        data={[{ id: 1, name: 'FromParent' }]}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
      />,
    )
    expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('FromParent')
  })
})
