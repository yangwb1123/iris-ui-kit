import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableHandle } from '../types'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  city: string
}

const rows: Row[] = [
  { id: 1, name: 'alice', city: 'Paris' },
  { id: 2, name: 'bob', city: 'Berlin' },
  { id: 3, name: 'cara', city: 'Oslo' },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'city', title: 'City', editable: true },
]

function handleRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

describe('IrisTable batch DU — exportAnnotationsCsv', () => {
  it('exports noted cells as spec-literal rowKey,column,annotation CSV', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{
          '1::name': '高亮',
          '2::city': '注意,含逗号',
        }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe(
      'rowKey,column,annotation\n1,name,高亮\n2,city,"注意,含逗号"',
    )
  })

  it('keeps bodyData row order and includes every noted cell of a row', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{
          '3::name': 'last row note',
          '1::city': 'first row city note',
          '1::name': 'first row name note',
        }}
        tableRef={ref}
      />,
    )
    // Row 1's two noted cells export in column order, then row 3's.
    expect(ref.current!.exportAnnotationsCsv()).toBe(
      'rowKey,column,annotation\n1,name,first row name note\n1,city,first row city note\n3,name,last row note',
    )
  })

  it('returns an empty string when the prop is on but no cell has a note', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': '' }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe('')
  })

  it('fails closed — returns "" without the exportAnnotations prop', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        annotations={{ '1::name': '高亮' }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe('')
  })

  it('resolves notes with dynamic cellNote winning over the static map', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '2::city': '静态 note' }}
        cellNote={(row) => (row.id === 2 ? '动态 note' : null)}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe(
      'rowKey,column,annotation\n2,name,动态 note\n2,city,动态 note',
    )
  })

  it('neutralizes formula-leading annotation text (OWASP)', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '2::name': '=SUM(A1)' }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe("rowKey,column,annotation\n2,name,'=SUM(A1)")
  })

  it('excludes notes on hidden columns', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': '高亮', '1::city': 'hidden note' }}
        columnVisibility={{ city: false }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe('rowKey,column,annotation\n1,name,高亮')
  })

  it('sees post-rerender annotation maps through the ref mirror', () => {
    const ref = handleRef()
    const { rerender } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': 'first' }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe('rowKey,column,annotation\n1,name,first')
    rerender(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': 'second' }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportAnnotationsCsv()).toBe('rowKey,column,annotation\n1,name,second')
  })

  it('column titles are the literal rowKey/column/annotation headers (no i18n)', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': '高亮' }}
        tableRef={ref}
      />,
    )
    const csv = ref.current!.exportAnnotationsCsv()
    expect(csv.split('\n')[0]).toBe('rowKey,column,annotation')
  })

  it('regression — exportAnnotations does not perturb other handle exports', () => {
    const ref = handleRef()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': '高亮' }}
        tableRef={ref}
      />,
    )
    expect(ref.current!.exportCurrentViewCsv()).toBe(
      'Name,City\nalice,Paris\nbob,Berlin\ncara,Oslo',
    )
    expect(ref.current!.exportRowsCsv([3, 1])).toBe('Name,City\nalice,Paris\ncara,Oslo')
    // The annotation props keep the context-menu / annotate panel path intact.
    expect(document.querySelector('[data-iris-cell-note-badge]')).not.toBeNull()
  })

  it('regression — editing a noted cell still flows through the normal funnel', () => {
    const ref = handleRef()
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        exportAnnotations
        annotations={{ '1::name': '高亮' }}
        onCellEdit={onCellEdit}
        tableRef={ref}
      />,
    )
    const cell = document.querySelector('[data-iris-table-row="1"] [data-iris-table-cell="name"]')!
    fireEvent.doubleClick(cell)
    const editor = document.querySelector('[data-iris-table-editor]')
    expect(editor).not.toBeNull()
    fireEvent.change(editor!, { target: { value: 'alice2' } })
    act(() => {
      fireEvent.keyDown(editor!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledTimes(1)
    expect(onCellEdit.mock.calls[0]![0].newValue).toBe('alice2')
    expect(ref.current!.exportAnnotationsCsv()).toBe('rowKey,column,annotation\n1,name,高亮')
  })
})
