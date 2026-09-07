import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  {
    key: 'name',
    title: 'Name',
    editable: true,
    editRules: [{ required: true }],
  },
  { key: 'age', title: 'Age', editable: true, editor: 'number' as const },
  { key: 'status', title: 'Status' },
]
const rows = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 25, status: 'paused' },
]

function cell(container: HTMLElement, rowIndex: number, key: string): HTMLElement {
  const rows = container.querySelectorAll<HTMLElement>(
    '[data-iris-table-body] [data-iris-table-row]',
  )
  return rows[rowIndex]!.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

describe('IrisTable editConfig.mode=row', () => {
  it('opens every editable cell, commits one column, and keeps the row session open', async () => {
    const onCellEdit = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        editConfig: { mode: 'row', showAsterisk: true },
        onCellEdit,
      },
    })

    expect(view.container.querySelector('[data-iris-table-header="name"]')?.textContent).toContain(
      '*',
    )
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const editors = view.container.querySelectorAll<HTMLInputElement>('[data-iris-table-editor]')
    await fireEvent.input(editors[0]!, { target: { value: 'Alicia' } })
    await fireEvent.keyDown(editors[0]!, { key: 'Enter' })

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: 'Alice', newValue: 'Alicia', rowIndex: 0 }),
    )
    expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(1)
    expect(view.container.querySelector('[data-iris-row-editing="true"]')).not.toBeNull()

    await fireEvent.keyDown(
      view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!,
      { key: 'Escape' },
    )
    expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(0)
  })

  it('Escape cancels all drafts and a validation error blocks switching rows', async () => {
    const onCellEdit = vi.fn()
    const validatedColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        validate: (value: unknown) => (value === '' ? 'Required' : null),
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: {
        columns: validatedColumns,
        data: rows,
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: '' } })
    await fireEvent.click(cell(view.container, 1, 'age'))

    expect(
      view.container
        .querySelector('[data-iris-row-editing="true"]')
        ?.getAttribute('data-iris-table-row-index'),
    ).toBe('0')
    expect(view.container.querySelector('[data-iris-table-editor-error]')?.textContent).toBe(
      'Required',
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await fireEvent.keyDown(nameEditor, { key: 'Escape' })
    expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(0)
  })

  it('clicking another row commits the first row before opening the next', async () => {
    const onCellEdit = vi.fn()
    const view = render(IrisTable, {
      props: { columns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    await fireEvent.input(
      view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!,
      {
        target: { value: 'Alicia' },
      },
    )
    await fireEvent.click(cell(view.container, 1, 'status'))

    await waitFor(() =>
      expect(onCellEdit).toHaveBeenCalledWith(
        expect.objectContaining({ row: rows[0], newValue: 'Alicia', rowIndex: 0 }),
      ),
    )
    expect(
      view.container
        .querySelector('[data-iris-row-editing="true"]')
        ?.getAttribute('data-iris-table-row-index'),
    ).toBe('1')
  })

  it('Escape cancels a pending async rule without a late commit', async () => {
    let resolveRule: ((message: string | null) => void) | undefined
    const onCellEdit = vi.fn()
    const asyncColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRule = resolve
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: { columns: asyncColumns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: 'Alicia' } })
    await fireEvent.blur(nameEditor)
    await fireEvent.keyDown(
      view.container.querySelectorAll<HTMLInputElement>('[data-iris-table-editor]')[1]!,
      { key: 'Escape' },
    )
    resolveRule?.(null)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('validates sync declarative rules and keeps text/number/no-op commits precise', async () => {
    const onCellEdit = vi.fn()
    const sourceRows = [
      { id: 1, name: 'Alice', age: 30, status: 'active' },
      { id: 2, name: 'Bob', age: 25, status: 'paused' },
    ]
    const view = render(IrisTable, {
      props: {
        columns,
        data: sourceRows,
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const editors = view.container.querySelectorAll<HTMLInputElement>('[data-iris-table-editor]')
    await fireEvent.input(editors[0]!, { target: { value: '' } })
    await fireEvent.keyDown(editors[0]!, { key: 'Enter' })
    expect(view.container.querySelector('[data-iris-table-editor-error]')?.textContent).toBe(
      'This field is required',
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await fireEvent.input(editors[0]!, { target: { value: 'Alicia' } })
    await fireEvent.keyDown(editors[0]!, { key: 'Enter' })
    await fireEvent.input(editors[1]!, { target: { value: '42' } })
    await fireEvent.keyDown(editors[1]!, { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledTimes(2)
    expect(onCellEdit.mock.calls[0]![0]).toMatchObject({ newValue: 'Alicia', rowIndex: 0 })
    expect(onCellEdit.mock.calls[0]![0].row).toBe(sourceRows[0])
    expect(onCellEdit.mock.calls[1]![0]).toMatchObject({ newValue: 42, rowIndex: 0 })
    expect(typeof onCellEdit.mock.calls[1]![0].newValue).toBe('number')
    expect(onCellEdit.mock.calls[1]![0].row).toMatchObject({
      id: 1,
      name: 'Alicia',
      age: 30,
    })

    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const noOpEditors = view.container.querySelectorAll<HTMLInputElement>(
      '[data-iris-table-editor]',
    )
    await fireEvent.keyDown(noOpEditors[0]!, { key: 'Enter' })
    await fireEvent.keyDown(noOpEditors[1]!, { key: 'Enter' })
    expect(onCellEdit).toHaveBeenCalledTimes(2)
  })

  it('shows an async declarative failure and accepts a later valid draft', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const onCellEdit = vi.fn()
    const asyncColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve)
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: { columns: asyncColumns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: 'bad' } })
    await fireEvent.keyDown(nameEditor, { key: 'Enter' })
    await waitFor(() => expect(resolvers).toHaveLength(1))
    resolvers[0]!('must be ok')
    await waitFor(() =>
      expect(view.container.querySelector('[data-iris-table-editor-error]')?.textContent).toBe(
        'must be ok',
      ),
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await fireEvent.input(nameEditor, { target: { value: 'ok' } })
    await fireEvent.keyDown(nameEditor, { key: 'Enter' })
    await waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[1]!(null)
    await waitFor(() => expect(onCellEdit).toHaveBeenCalledTimes(1))
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'ok' }))
  })

  it('drops a stale async result after the draft changes, then commits the latest draft', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const onCellEdit = vi.fn()
    const asyncColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve)
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: { columns: asyncColumns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: 'first' } })
    await fireEvent.keyDown(nameEditor, { key: 'Enter' })
    await waitFor(() => expect(resolvers).toHaveLength(1))
    await fireEvent.input(nameEditor, { target: { value: 'second' } })
    resolvers[0]!(null)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-iris-table-editor-error]')).toBeNull()

    await fireEvent.keyDown(nameEditor, { key: 'Enter' })
    await waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[1]!(null)
    await waitFor(() => expect(onCellEdit).toHaveBeenCalledTimes(1))
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'second' }))
  })

  it('invalidates a pending result on row switch and on disposal', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const onCellEdit = vi.fn()
    const asyncColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve)
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: { columns: asyncColumns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: 'Alicia' } })
    await fireEvent.keyDown(nameEditor, { key: 'Enter' })
    await waitFor(() => expect(resolvers.length).toBeGreaterThan(0))
    await fireEvent.click(cell(view.container, 1, 'age'))
    expect(
      view.container
        .querySelector('[data-iris-row-editing="true"]')
        ?.getAttribute('data-iris-table-row-index'),
    ).toBe('1')
    for (const resolve of resolvers) resolve('stale')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onCellEdit).not.toHaveBeenCalled()

    const disposeResolvers: Array<(message: string | null) => void> = []
    const disposeView = render(IrisTable, {
      props: {
        columns: [
          {
            key: 'name',
            title: 'Name',
            editable: true,
            editRules: [
              {
                validator: () =>
                  new Promise<string | null>((resolve) => {
                    disposeResolvers.push(resolve)
                  }),
              },
            ],
          },
        ],
        data: rows,
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })
    await fireEvent.click(cell(disposeView.container, 0, 'name'))
    await waitFor(() =>
      expect(disposeView.container.querySelector('[data-iris-table-editor]')).not.toBeNull(),
    )
    await fireEvent.keyDown(
      disposeView.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!,
      { key: 'Enter' },
    )
    await waitFor(() => expect(disposeResolvers).toHaveLength(1))
    disposeView.unmount()
    disposeResolvers[0]!(null)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it('ignores a stale blur after a same-id row session is reopened', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onCellEdit = vi.fn()
    try {
      const view = render(IrisTable, {
        props: { columns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
      })
      await fireEvent.click(cell(view.container, 0, 'name'))
      await waitFor(() =>
        expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
      )
      const oldEditor = view.container.querySelector<HTMLInputElement>(
        '[data-iris-table-cell="name"] [data-iris-table-editor]',
      )!
      await fireEvent.keyDown(oldEditor, { key: 'Enter' })
      await fireEvent.click(cell(view.container, 0, 'name'))
      await waitFor(() =>
        expect(
          view.container.querySelector('[data-iris-table-cell="name"] [data-iris-table-editor]'),
        ).not.toBeNull(),
      )
      const reopened = view.container.querySelector<HTMLInputElement>(
        '[data-iris-table-cell="name"] [data-iris-table-editor]',
      )!
      expect(reopened).not.toBe(oldEditor)
      await fireEvent.input(reopened, { target: { value: 'reopened' } })
      await fireEvent.blur(oldEditor)
      expect(onCellEdit).not.toHaveBeenCalled()
      expect(
        view.container.querySelector('[data-iris-table-cell="name"] [data-iris-table-editor]'),
      ).toBe(reopened)
      expect([...warnSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ')).not.toContain(
        'derived_inert',
      )

      await fireEvent.keyDown(reopened, { key: 'Enter' })
      await waitFor(() => expect(onCellEdit).toHaveBeenCalledTimes(1))
      expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'reopened' }))
    } finally {
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})
