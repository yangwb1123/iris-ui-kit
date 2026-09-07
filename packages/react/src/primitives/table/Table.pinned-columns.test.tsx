import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

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

describe('@iris-ui-kit/react IrisTable pinned columns', () => {
  const cols: IrisTableColumn<Row>[] = [
    { key: 'name', title: 'Name', width: 100, pinned: 'left' },
    { key: 'age', title: 'Age', width: 80 },
    { key: 'act', title: 'Act', width: 60, pinned: 'right' },
  ]

  it('makes pinned header + cells sticky with edge offsets', () => {
    render(<IrisTable columns={cols} data={rows} />)
    const nameHeader = document.querySelector('[data-iris-table-header="name"]') as HTMLElement
    expect(nameHeader.getAttribute('data-iris-table-pinned')).toBe('left')
    expect(nameHeader.style.position).toBe('sticky')
    expect(nameHeader.style.left).toBe('0px')
    const actHeader = document.querySelector('[data-iris-table-header="act"]') as HTMLElement
    expect(actHeader.style.position).toBe('sticky')
    expect(actHeader.style.right).toBe('0px')
    // Body cells are pinned too.
    const nameCell = document.querySelector('[data-iris-table-cell="name"]') as HTMLElement
    expect(nameCell.style.position).toBe('sticky')
    // Unpinned column has no sticky positioning.
    const ageHeader = document.querySelector('[data-iris-table-header="age"]') as HTMLElement
    expect(ageHeader.style.position).toBe('relative')
    expect(ageHeader.getAttribute('data-iris-table-pinned')).toBeNull()
  })

  it('offsets a left-pinned column by the selection column width', () => {
    render(<IrisTable columns={cols} data={rows} selectable="multi" />)
    const nameHeader = document.querySelector('[data-iris-table-header="name"]') as HTMLElement
    expect(nameHeader.style.left).toBe('40px')
  })
})
