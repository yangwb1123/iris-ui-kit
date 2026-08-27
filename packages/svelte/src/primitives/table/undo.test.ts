import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
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

function tableRef(): { current: IrisTableHandle | null } {
  return { current: null }
}

function bodyRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')]
}

async function ready(ref: { current: IrisTableHandle | null }): Promise<void> {
  await waitFor(() => expect(ref.current).not.toBeNull())
}

describe('Svelte IrisTable undo/redo', () => {
  it('is default-off and does not intercept Ctrl+Z', async () => {
    const ref = tableRef()
    const { container } = render(IrisTable, { props: { columns, data: rows, tableRef: ref } })
    await ready(ref)

    ref.current!.removeRows([2])
    await waitFor(() => expect(bodyRows(container)).toHaveLength(1))
    expect(container.querySelector('[data-iris-table-undo]')).toBeNull()
    await fireEvent.keyDown(container.querySelector('[data-iris-table]')!, {
      key: 'z',
      ctrlKey: true,
    })
    expect(bodyRows(container)).toHaveLength(1)
  })

  it('undoes and redoes row operations through controls and shortcuts', async () => {
    const ref = tableRef()
    const onDataChange = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data: rows, undo: true, tableRef: ref, onDataChange },
    })
    await ready(ref)

    ref.current!.removeRows([2])
    const root = container.querySelector('[data-iris-table]')!
    const undo = () => container.querySelector<HTMLButtonElement>('[data-iris-table-undo]')!
    const redo = () => container.querySelector<HTMLButtonElement>('[data-iris-table-redo]')!
    await waitFor(() => expect(undo().disabled).toBe(false))
    await fireEvent.click(undo())
    await waitFor(() => expect(bodyRows(container)).toHaveLength(2))
    expect(onDataChange).toHaveBeenCalledTimes(2)
    await fireEvent.click(redo())
    await waitFor(() => expect(bodyRows(container)).toHaveLength(1))
    expect(onDataChange).toHaveBeenCalledTimes(3)

    await fireEvent.keyDown(root, { key: 'z', metaKey: true })
    await waitFor(() => expect(bodyRows(container)).toHaveLength(2))
    await fireEvent.keyDown(root, { key: 'z', metaKey: true, shiftKey: true })
    await waitFor(() => expect(bodyRows(container)).toHaveLength(1))
    await fireEvent.keyDown(root, { key: 'y', ctrlKey: true })
    expect(bodyRows(container)).toHaveLength(1)
  })

  it('records cell edits as post-change snapshots', async () => {
    const ref = tableRef()
    const { container } = render(IrisTable, {
      props: { columns, data: rows, undo: true, tableRef: ref },
    })
    await ready(ref)

    await fireEvent.dblClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const editor = () => container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(editor(), { target: { value: 'Gamma' } })
    await fireEvent.keyDown(editor(), { key: 'Enter' })
    await waitFor(() => expect(container.textContent).toContain('Gamma'))

    await fireEvent.click(container.querySelector('[data-iris-table-undo]')!)
    await waitFor(() => expect(container.textContent).toContain('Alpha'))
    await fireEvent.click(container.querySelector('[data-iris-table-redo]')!)
    await waitFor(() => expect(container.textContent).toContain('Gamma'))
  })

  it('records row-editor commits and does not hijack an open editor', async () => {
    const rowColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'age', title: 'Age', editable: true, editor: 'number' },
    ]
    const ref = tableRef()
    const { container } = render(IrisTable, {
      props: {
        columns: rowColumns,
        data: [{ id: 1, name: 'Alpha', age: 1 }],
        editConfig: { mode: 'row' },
        undo: true,
        tableRef: ref,
      },
    })
    await ready(ref)

    await fireEvent.click(container.querySelector('[data-iris-table-cell="name"]')!)
    const editors = () => container.querySelectorAll<HTMLInputElement>('[data-iris-table-editor]')
    await waitFor(() => expect(editors()).toHaveLength(2))
    await fireEvent.input(editors()[0]!, { target: { value: 'Edited' } })
    await fireEvent.keyDown(editors()[0]!, { key: 'Enter' })
    await fireEvent.keyDown(editors()[0]!, { key: 'z', ctrlKey: true })
    expect(editors()).toHaveLength(1)
    expect(container.querySelector<HTMLButtonElement>('[data-iris-table-undo]')!.disabled).toBe(
      true,
    )

    await fireEvent.keyDown(editors()[0]!, { key: 'Escape' })
    await waitFor(() => expect(container.textContent).toContain('Edited'))
    await fireEvent.click(container.querySelector('[data-iris-table-undo]')!)
    await waitFor(() => expect(container.textContent).toContain('Alpha'))
  })

  it('keeps non-proxy edits in filtered data and handle snapshots', async () => {
    const ref = tableRef()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: [{ id: 1, name: 'Alpha' }],
        filters: { name: 'Alpha' },
        undo: true,
        tableRef: ref,
      },
    })
    await ready(ref)

    await fireEvent.dblClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const editor = container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(editor, { target: { value: 'Beta' } })
    await fireEvent.keyDown(editor, { key: 'Enter' })
    await waitFor(() => expect(bodyRows(container)).toHaveLength(0))
    expect(ref.current!.getFilteredData()).toEqual([])
  })

  it('keeps reference-identical rows as distinct undo snapshots', async () => {
    const ref = tableRef()
    const { container } = render(IrisTable, {
      props: { columns, data: rows, undo: true, tableRef: ref },
    })
    await ready(ref)

    ref.current!.loadData([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ])
    await waitFor(() =>
      expect(container.querySelector<HTMLButtonElement>('[data-iris-table-undo]')!.disabled).toBe(
        false,
      ),
    )
    await fireEvent.click(container.querySelector('[data-iris-table-undo]')!)
    await waitFor(() =>
      expect(container.querySelector<HTMLButtonElement>('[data-iris-table-undo]')!.disabled).toBe(
        true,
      ),
    )
  })

  it('records clipboard paste in one row-list undo step', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const readText = vi.fn().mockResolvedValue('Pasted')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText } })
    try {
      const { container } = render(IrisTable, {
        props: { columns, data: rows, undo: true, cellRange: true, clipConfig: { paste: true } },
      })
      const root = container.querySelector('[data-iris-table]')!
      await fireEvent.click(container.querySelector('[data-iris-table-cell="name"]')!)
      await fireEvent.keyDown(root, { key: 'v', ctrlKey: true })
      await waitFor(() => expect(readText).toHaveBeenCalled())
      await waitFor(() => expect(container.textContent).toContain('Pasted'))
      await fireEvent.click(container.querySelector('[data-iris-table-undo]')!)
      await waitFor(() => expect(container.textContent).toContain('Alpha'))
    } finally {
      if (previous) Object.defineProperty(navigator, 'clipboard', previous)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('prunes selection keys when replay restores a shorter row set', async () => {
    const ref = tableRef()
    const onUpdateSelection = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        selectable: 'multi',
        defaultSelection: [2],
        undo: true,
        tableRef: ref,
        onUpdateSelection,
      },
    })
    await ready(ref)

    ref.current!.loadData([{ id: 1, name: 'Only row' }])
    await fireEvent.click(container.querySelector('[data-iris-table-undo]')!)
    await waitFor(() => expect(bodyRows(container)).toHaveLength(2))
    await fireEvent.click(container.querySelector('[data-iris-table-redo]')!)
    await waitFor(() => expect(bodyRows(container)).toHaveLength(1))
    expect(onUpdateSelection).toHaveBeenCalledWith([])
  })

  it('re-baselines an untouched stack when parent data changes', async () => {
    const ref = tableRef()
    const view = render(IrisTable, {
      props: { columns, data: rows, undo: true, tableRef: ref },
    })
    await ready(ref)
    await view.rerender({
      data: [
        { id: 1, name: 'Baselined' },
        { id: 2, name: 'Beta' },
      ],
    })
    await fireEvent.dblClick(view.container.querySelector('[data-iris-table-cell="name"]')!)
    const editor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(editor, { target: { value: 'Edited' } })
    await fireEvent.keyDown(editor, { key: 'Enter' })
    await fireEvent.click(view.container.querySelector('[data-iris-table-undo]')!)
    await waitFor(() => expect(view.container.textContent).toContain('Baselined'))
    expect(view.container.textContent).not.toContain('Edited')
  })

  it('replays edits against proxy live rows', async () => {
    const query = vi.fn().mockResolvedValue({ rows, total: rows.length })
    const ref = tableRef()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        undo: true,
        tableRef: ref,
        proxyConfig: { query },
      },
    })
    await ready(ref)
    await waitFor(() => expect(query).toHaveBeenCalled())
    await waitFor(() => expect(bodyRows(container)).toHaveLength(2))
    await fireEvent.dblClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const editor = container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(editor, { target: { value: 'Renamed' } })
    await fireEvent.keyDown(editor, { key: 'Enter' })
    await waitFor(() => expect(container.textContent).toContain('Renamed'))
    await fireEvent.click(container.querySelector('[data-iris-table-undo]')!)
    await waitFor(() => expect(container.textContent).toContain('Alpha'))
    await fireEvent.click(container.querySelector('[data-iris-table-redo]')!)
    await waitFor(() => expect(container.textContent).toContain('Renamed'))
  })
})
