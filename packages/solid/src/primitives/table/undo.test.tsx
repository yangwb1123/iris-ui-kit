import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Row = { id: number; name: string; age?: number }

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', editable: true }]
const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
]

const root = (): HTMLElement => document.querySelector('[data-iris-table]') as HTMLElement
const rowCount = (): number => document.querySelectorAll('[data-iris-table-row=""]').length
const nameCell = (index = 0): HTMLElement =>
  document.querySelectorAll<HTMLElement>('[data-iris-table-cell="name"]')[index]!
const undoButton = (): HTMLButtonElement =>
  document.querySelector('[data-iris-table-undo]') as HTMLButtonElement
const redoButton = (): HTMLButtonElement =>
  document.querySelector('[data-iris-table-redo]') as HTMLButtonElement
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function tableRef(): { current: IrisTableHandle<Row> | null } {
  return { current: null }
}

describe('Solid IrisTable undo/redo', () => {
  it('is default-off and leaves row mutations without shortcut controls', () => {
    const ref = tableRef()
    render(() => <IrisTable columns={columns} data={rows} rowKey="id" tableRef={ref} />)

    ref.current!.removeRows([2])
    expect(rowCount()).toBe(1)
    expect(document.querySelector('[data-iris-table-undo]')).toBeNull()
    fireEvent.keyDown(root(), { key: 'z', ctrlKey: true })
    expect(rowCount()).toBe(1)
  })

  it('undoes and redoes row-list mutations through controls and shortcuts', () => {
    const onDataChange = vi.fn()
    const ref = tableRef()
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        undo
        tableRef={ref}
        onDataChange={onDataChange}
      />
    ))

    ref.current!.removeRows([2])
    expect(undoButton().disabled).toBe(false)
    fireEvent.click(undoButton())
    expect(rowCount()).toBe(2)
    expect(onDataChange).toHaveBeenCalledTimes(2)
    fireEvent.click(redoButton())
    expect(rowCount()).toBe(1)
    expect(onDataChange).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(root(), { key: 'z', metaKey: true })
    expect(rowCount()).toBe(2)
    fireEvent.keyDown(root(), { key: 'z', metaKey: true, shiftKey: true })
    expect(rowCount()).toBe(1)
    fireEvent.keyDown(root(), { key: 'y', ctrlKey: true })
    expect(rowCount()).toBe(1)
    expect(onDataChange).toHaveBeenCalledTimes(5)
  })

  it('clears the redo branch after a new row-list mutation', () => {
    const ref = tableRef()
    render(() => <IrisTable columns={columns} data={rows} rowKey="id" undo tableRef={ref} />)

    ref.current!.removeRows([2])
    fireEvent.click(undoButton())
    expect(redoButton().disabled).toBe(false)
    ref.current!.loadData([{ id: 1, name: 'Branch' }])
    expect(redoButton().disabled).toBe(true)
    expect(document.body.textContent).toContain('Branch')
  })

  it('records cell and row editor commits as post-change snapshots', () => {
    const ref = tableRef()
    const rowColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    render(() => (
      <IrisTable
        columns={rowColumns}
        data={[{ id: 1, name: 'Alpha', age: 1 }]}
        rowKey="id"
        undo
        editConfig={{ mode: 'row' }}
        tableRef={ref}
      />
    ))

    fireEvent.click(document.querySelector('[data-iris-table-cell="name"]')!)
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.input(editor, { target: { value: 'Edited' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    fireEvent.keyDown(document.querySelector('[data-iris-table-editor]')!, { key: 'Escape' })
    expect(document.body.textContent).toContain('Edited')

    fireEvent.click(undoButton())
    expect(document.body.textContent).toContain('Alpha')
    fireEvent.click(redoButton())
    expect(document.body.textContent).toContain('Edited')
  })

  it('keeps non-proxy edits in filtered data and handle snapshots', () => {
    const ref = tableRef()
    render(() => (
      <IrisTable
        columns={columns}
        data={[{ id: 1, name: 'Alpha' }]}
        rowKey="id"
        filters={{ name: 'Alpha' }}
        undo
        tableRef={ref}
      />
    ))

    fireEvent.dblClick(nameCell())
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.input(editor, { target: { value: 'Beta' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(ref.current!.getFilteredData()).toEqual([])
    expect(rowCount()).toBe(0)
  })

  it('keeps reference-identical rows as distinct undo snapshots', () => {
    const ref = tableRef()
    render(() => <IrisTable columns={columns} data={rows} rowKey="id" undo tableRef={ref} />)

    ref.current!.loadData([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ])
    expect(undoButton().disabled).toBe(false)
    fireEvent.click(undoButton())
    expect(undoButton().disabled).toBe(true)
  })

  it('does not hijack undo while an editor owns focus', () => {
    const ref = tableRef()
    render(() => <IrisTable columns={columns} data={rows} rowKey="id" undo tableRef={ref} />)
    ref.current!.removeRows([2])
    fireEvent.dblClick(nameCell())
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement

    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true })
    expect(editor.isConnected).toBe(true)
    expect(rowCount()).toBe(1)
    expect(undoButton().disabled).toBe(true)
  })

  it('records clipboard paste in one row-list undo step', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const readText = vi.fn().mockResolvedValue('Pasted')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    })
    try {
      render(() => (
        <IrisTable
          columns={columns}
          data={rows}
          rowKey="id"
          undo
          cellRange
          clipConfig={{ paste: true }}
        />
      ))
      fireEvent.click(nameCell())
      fireEvent.keyDown(root(), { key: 'v', ctrlKey: true })
      await settle()
      expect(readText).toHaveBeenCalled()
      expect(document.body.textContent).toContain('Pasted')
      fireEvent.click(undoButton())
      expect(document.body.textContent).toContain('Alpha')
    } finally {
      if (previous) Object.defineProperty(navigator, 'clipboard', previous)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('prunes selection keys that disappear during replay', () => {
    const ref = tableRef()
    render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" selectable="multi" undo tableRef={ref} />
    ))
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      '[data-iris-table-row] input[type="checkbox"]',
    )
    fireEvent.click(checkboxes[1]!)
    ref.current!.loadData([{ id: 1, name: 'Only one' }])
    fireEvent.click(undoButton())
    expect(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
    ).toHaveLength(1)
    fireEvent.click(redoButton())
    expect(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
    ).toHaveLength(0)
  })

  it('re-baselines an untouched stack when parent data changes', () => {
    const [data, setData] = createSignal<Row[]>(rows)
    const ref = tableRef()
    render(() => <IrisTable columns={columns} data={data()} rowKey="id" undo tableRef={ref} />)
    setData([
      { id: 1, name: 'Baselined' },
      { id: 2, name: 'Beta' },
    ])
    fireEvent.dblClick(nameCell())
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.input(editor, { target: { value: 'Edited' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    fireEvent.click(undoButton())
    expect(document.body.textContent).toContain('Baselined')
    expect(document.body.textContent).not.toContain('Edited')
  })

  it('replays edits against proxy live rows', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'Alpha' }], total: 1 }))
    const ref = tableRef()
    render(() => (
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        undo
        tableRef={ref}
        proxyConfig={{ query }}
      />
    ))
    await settle()
    const cell = nameCell()
    fireEvent.dblClick(cell)
    const editor = document.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.input(editor, { target: { value: 'Renamed' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(document.body.textContent).toContain('Renamed')
    fireEvent.click(undoButton())
    expect(document.body.textContent).toContain('Alpha')
    fireEvent.click(redoButton())
    expect(document.body.textContent).toContain('Renamed')
    expect(query).toHaveBeenCalled()
  })
})
