import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'clipboard')
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function cell(row: number, column: number): HTMLElement {
  return document.querySelector(
    `[data-iris-cell-row="${row}"][data-iris-cell-col="${column}"]`,
  ) as HTMLElement
}

describe('IrisTable Grid Core clipboard integration', () => {
  it('copies from sorted visible coordinates', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        defaultSort={{ key: 'name', direction: 'asc' }}
        cellRange
        clipConfig={{}}
      />,
    )

    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(root(), { key: 'c', ctrlKey: true })

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Alice'))
  })

  it('reconciles a sorted visible paste into the original row order', async () => {
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('Updated') },
    })
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        defaultSort={{ key: 'name', direction: 'asc' }}
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )

    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce())
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Charlie', age: 25 },
      { id: 2, name: 'Updated', age: 32 },
      { id: 3, name: 'Bob', age: 28 },
    ])
  })

  it('keeps formula columns display-only during paste', async () => {
    const onDataChange = vi.fn()
    const formulaColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'score', title: 'Score', formula: 'age + 1', editable: true },
    ]
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('999') },
    })
    render(
      <IrisTable
        columns={formulaColumns}
        data={rows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )

    fireEvent.click(cell(0, 1))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(onDataChange).not.toHaveBeenCalled()
  })

  it('reconciles a visible tree-child paste into the nested Core row source', async () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const treeRows: TreeRow[] = [
      {
        id: 1,
        name: 'Root',
        age: 40,
        children: [{ id: 11, name: 'Child', age: 10 }],
      },
      { id: 2, name: 'Sibling', age: 20 },
    ]
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('Updated child') },
    })
    render(
      <IrisTable
        columns={columns}
        data={treeRows}
        rowKey="id"
        getSubRows={(row) => row.children}
        defaultExpandedRowKeys={[1]}
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )

    fireEvent.click(cell(1, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce())
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      {
        id: 1,
        name: 'Root',
        age: 40,
        children: [{ id: 11, name: 'Updated child', age: 10 }],
      },
      { id: 2, name: 'Sibling', age: 20 },
    ])
  })

  it('reconciles a lazy-loaded tree-child paste into the nested Core row source', async () => {
    type TreeRow = Row & { children?: TreeRow[] }
    const treeRows: TreeRow[] = [{ id: 1, name: 'Root', age: 40 }]
    const lazyLoad = vi.fn((_row: TreeRow, load: (children: TreeRow[]) => void) => {
      load([{ id: 11, name: 'Lazy child', age: 10 }])
    })
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('Updated lazy child') },
    })
    render(
      <IrisTable
        columns={columns}
        data={treeRows}
        rowKey="id"
        lazyLoad={lazyLoad}
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )

    fireEvent.click(
      document.querySelector(
        '[data-iris-table-row="1"] [data-iris-table-tree-toggle]',
      ) as HTMLElement,
    )
    expect(document.querySelector('[data-iris-table-row="11"]')).not.toBeNull()
    fireEvent.click(cell(1, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce())
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      {
        id: 1,
        name: 'Root',
        age: 40,
        children: [{ id: 11, name: 'Updated lazy child', age: 10 }],
      },
    ])
  })

  it('writes clipboard values through a column dataIndex', async () => {
    type AliasRow = Row & { displayName: string }
    const aliasRows: AliasRow[] = [
      { id: 1, name: 'Ada', age: 30, displayName: 'A' },
      { id: 2, name: 'Lin', age: 40, displayName: 'L' },
    ]
    const aliasColumns: IrisTableColumn<AliasRow>[] = [
      { key: 'displayName', dataIndex: 'name', title: 'Name' },
    ]
    const onDataChange = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('Renamed') },
    })
    render(
      <IrisTable
        columns={aliasColumns}
        data={aliasRows}
        rowKey="id"
        cellRange
        clipConfig={{}}
        onDataChange={onDataChange}
      />,
    )

    fireEvent.click(cell(0, 0))
    fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })

    await waitFor(() => expect(onDataChange).toHaveBeenCalledOnce())
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Renamed', age: 30, displayName: 'A' },
      { id: 2, name: 'Lin', age: 40, displayName: 'L' },
    ])
  })
})
