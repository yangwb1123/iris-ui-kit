import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTableRowEditModel, type TableRowEditOptions } from './table-row-edit'

type Row = { id: number; name: string; age: number }
type Column = 'name' | 'age'
const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
})

function deferred() {
  let resolve!: (value: string | null) => void
  const promise = new Promise<string | null>((done) => (resolve = done))
  return { promise, resolve }
}

async function flushValidation() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function fixture(overrides: Partial<TableRowEditOptions<Row, Column, number>> = {}) {
  const source: Row = { id: 1, name: 'Alice', age: 30 }
  const other: Row = { id: 2, name: 'Bob', age: 25 }
  let rows = [source, other]
  let editable = true
  const commits = vi.fn()
  const validations = vi.fn()
  const model = createTableRowEditModel<Row, Column, number>({
    getRows: () => rows,
    getColumns: () => ['name'],
    getColumnKey: (column) => column,
    getRowKey: (row) => row.id,
    getCellValue: (row, column) => row[column],
    isEditable: () => editable,
    findRow: (key) => rows.find((row) => row.id === key),
    onCommit: commits,
    onValidation: validations,
    ...overrides,
  })
  cleanups.push(() => model.dispose())
  return {
    model,
    source,
    other,
    commits,
    validations,
    replaceRows: (next: Row[]) => {
      rows = next
    },
    setEditable: (next: boolean) => {
      editable = next
    },
  }
}

describe('row edit public boundaries', () => {
  it('opens additional cells, preserves existing drafts, and commits before switching rows', () => {
    const { model, source, other, commits } = fixture()
    expect(model.openCell(source, 'name', 7)).toBe(true)
    expect(model.setDraft('1::name', 'Alicia')).toBe(true)
    const session = model.session('1::name')
    expect(model.openCell(source, 'name', 9)).toBe(true)
    expect(model.session('1::name')).toBe(session)
    expect(model.openCell(source, 'age', 11)).toBe(true)
    expect(model.session('1::age')).toMatchObject({ draft: 30, rowIndex: 11 })
    expect(model.commit('1::name')).toBe(true)
    expect(model.getActive()).toEqual({ key: 1, index: 7 })
    const active = model.getActive()!
    Object.assign(active, { key: 99, index: 99 })
    expect(model.getActive()).toEqual({ key: 1, index: 7 })
    model.setDraft('1::age', 31)
    expect(model.openCell(other, 'name', 5)).toBe(true)
    expect(commits.mock.calls.map(([commit]) => commit)).toEqual([
      {
        rowKey: 1,
        row: source,
        column: 'name',
        rowIndex: 7,
        oldValue: 'Alice',
        newValue: 'Alicia',
      },
      { rowKey: 1, row: source, column: 'age', rowIndex: 11, oldValue: 30, newValue: 31 },
    ])
    expect(model.getActive()).toEqual({ key: 2, index: 5 })
    expect(model.setDraft('1::name', 'stale')).toBe(false)
    expect(model.commit('1::name')).toBe(true)
    expect(model.session('2::name')?.draft).toBe('Bob')
  })

  it('refuses rows with no editable columns and cells whose permission is revoked', () => {
    const f = fixture()
    f.setEditable(false)
    expect(f.model.begin(f.source, 0)).toBe(false)
    expect(f.model.openCell(f.source, 'name', 0)).toBe(false)
    expect(f.model.getActive()).toBeNull()
    f.setEditable(true)
    f.model.begin(f.source, 0)
    const snapshot = f.model.getState()
    f.setEditable(false)
    expect(f.model.openCell(f.source, 'age', 0)).toBe(false)
    expect(f.model.getState()).toBe(snapshot)
    expect(f.commits).not.toHaveBeenCalled()
  })

  it('keeps a removed row open with an error and refuses a switch after synchronous failure', () => {
    const f = fixture()
    f.model.begin(f.source, 4)
    f.model.setDraft('1::name', 'Alicia')
    f.replaceRows([f.other])
    expect(f.model.commit('1::name')).toBe(false)
    expect(f.model.session('1::name')).toMatchObject({
      draft: 'Alicia',
      error: 'The edited row no longer exists',
      pending: false,
    })
    expect(f.model.switch(f.other, 1)).toBe(false)
    expect(f.model.getActive()).toEqual({ key: 1, index: 4 })
    expect(f.model.begin(f.source, 0)).toBe(false)
    expect(f.model.openCell(f.source, 'name', 0)).toBe(false)
    expect(f.commits).not.toHaveBeenCalled()
    expect(f.validations).not.toHaveBeenCalled()
  })

  it('makes every editing entry point inert after disposal', () => {
    const { model, source, commits, validations } = fixture()
    model.begin(source, 0)
    model.dispose()
    const snapshot = model.getState()
    const observer = vi.fn()
    const unsubscribe = model.store.subscribe(observer)
    expect(model.begin(source, 0)).toBe(false)
    expect(model.switch(source, 0)).toBe(false)
    expect(model.openCell(source, 'name', 0)).toBe(false)
    expect(model.setDraft('1::name', 'late')).toBe(false)
    expect(model.commit('1::name')).toBe(false)
    expect(model.commitAll()).toBe(false)
    model.cancelAll()
    model.dispose()
    expect(model.getState()).toBe(snapshot)
    expect(model.getActive()).toBeNull()
    expect(observer).not.toHaveBeenCalled()
    expect(commits).not.toHaveBeenCalled()
    expect(validations).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('cancels an already empty model without emitting a new snapshot', () => {
    const { model } = fixture()
    const snapshot = model.getState()
    model.cancelAll()
    expect(model.getState()).toBe(snapshot)
    expect(model.commitAll()).toBe(true)
  })

  it.each(['cancel', 'dispose', 'remove', 'replace', 'readonly', 'draft'] as const)(
    'honors %s from a synchronous validation observer before writing',
    (change) => {
      const f = fixture()
      f.validations.mockImplementation(() => {
        if (change === 'cancel') f.model.cancelAll()
        if (change === 'dispose') f.model.dispose()
        if (change === 'remove') f.replaceRows([f.other])
        if (change === 'replace') f.replaceRows([{ ...f.source }, f.other])
        if (change === 'readonly') f.setEditable(false)
        if (change === 'draft') f.model.setDraft('1::name', 'revised')
      })
      f.model.begin(f.source, 8)
      f.model.setDraft('1::name', 'Alicia')
      expect(f.model.commit('1::name')).toBe(false)
      expect(f.validations).toHaveBeenCalledExactlyOnceWith({
        rowKey: 1,
        row: f.source,
        column: 'name',
        rowIndex: 8,
        valid: true,
        commit: true,
        source: 'none',
      })
      expect(f.commits).not.toHaveBeenCalled()
      if (change === 'cancel' || change === 'dispose') expect(f.model.getActive()).toBeNull()
      else
        expect(f.model.session('1::name')).toMatchObject({
          draft: change === 'draft' ? 'revised' : 'Alicia',
          pending: false,
          error:
            change === 'draft'
              ? null
              : change === 'readonly'
                ? 'This cell is not editable'
                : 'The edited row no longer exists',
        })
      expect(f.source.name).toBe('Alice')
    },
  )

  it('does not resurrect an invalid session cancelled by its validation observer', () => {
    const f = fixture({ validate: () => 'invalid' })
    f.validations.mockImplementation(() => f.model.cancelAll())
    f.model.begin(f.source, 0)
    expect(f.model.commit('1::name')).toBe(false)
    expect(f.model.getActive()).toBeNull()
    expect(f.model.session('1::name')).toBeUndefined()
    expect(f.validations).toHaveBeenCalledWith(
      expect.objectContaining({ valid: false, source: 'custom' }),
    )
    expect(f.commits).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'respects cancellation while checking editability (editable=%s)',
    (allowed) => {
      let checkingCommit = false
      const f = fixture({
        isEditable: () => {
          if (!checkingCommit) return true
          f.model.cancelAll()
          return allowed
        },
      })
      f.model.begin(f.source, 0)
      checkingCommit = true
      expect(f.model.commit('1::name')).toBe(false)
      expect(f.model.getActive()).toBeNull()
      expect(f.validations).not.toHaveBeenCalled()
      expect(f.commits).not.toHaveBeenCalled()
    },
  )

  it.each([null, 'stale failure'])(
    'silences a superseded async result %s after a row switch',
    async (result) => {
      const gate = deferred()
      const f = fixture({ validate: () => gate.promise })
      f.model.begin(f.source, 0)
      f.model.setDraft('1::name', 'first')
      expect(f.model.commit('1::name')).toBe(true)
      f.model.setDraft('1::name', 'second')
      f.model.begin(f.other, 1)
      const snapshot = f.model.getState()
      gate.resolve(result)
      await flushValidation()
      expect(f.model.getState()).toBe(snapshot)
      expect(f.model.session('2::name')?.draft).toBe('Bob')
      expect(f.validations).not.toHaveBeenCalled()
      expect(f.commits).not.toHaveBeenCalled()
    },
  )

  it.each(['Alice', 'Alicia'])(
    'settles a detached draft %s on its original source only',
    async (draft) => {
      const gate = deferred()
      const f = fixture({ validate: () => gate.promise })
      f.model.begin(f.source, 6)
      f.model.setDraft('1::name', draft)
      f.model.commit('1::name')
      f.model.begin(f.other, 1)
      f.model.begin(f.other, 2)
      const snapshot = f.model.getState()
      gate.resolve(null)
      await flushValidation()
      expect(f.validations).toHaveBeenCalledExactlyOnceWith({
        rowKey: 1,
        row: f.source,
        column: 'name',
        rowIndex: 6,
        valid: true,
        commit: true,
        source: 'custom',
      })
      if (draft === 'Alice') expect(f.commits).not.toHaveBeenCalled()
      else
        expect(f.commits).toHaveBeenCalledExactlyOnceWith({
          rowKey: 1,
          row: f.source,
          column: 'name',
          rowIndex: 6,
          oldValue: 'Alice',
          newValue: draft,
        })
      expect(f.model.getState()).toBe(snapshot)
    },
  )

  it('silences a detached success when permissions change before validation settles', async () => {
    const gate = deferred()
    const f = fixture({ validate: () => gate.promise })
    f.model.begin(f.source, 0)
    f.model.setDraft('1::name', 'Alicia')
    f.model.commit('1::name')
    f.model.begin(f.other, 1)
    const snapshot = f.model.getState()
    f.setEditable(false)
    gate.resolve(null)
    await flushValidation()
    expect(f.model.getState()).toBe(snapshot)
    expect(f.model.session('2::name')?.error).toBeNull()
    expect(f.validations).not.toHaveBeenCalled()
    expect(f.commits).not.toHaveBeenCalled()
  })

  it.each(['dispose', 'remove', 'readonly'] as const)(
    'rechecks %s from a detached async validation observer',
    async (change) => {
      const gate = deferred()
      const f = fixture({ validate: () => gate.promise })
      f.validations.mockImplementation(() => {
        if (change === 'dispose') f.model.dispose()
        if (change === 'remove') f.replaceRows([f.other])
        if (change === 'readonly') f.setEditable(false)
      })
      f.model.begin(f.source, 0)
      f.model.setDraft('1::name', 'Alicia')
      f.model.commit('1::name')
      f.model.begin(f.other, 1)
      gate.resolve(null)
      await flushValidation()
      expect(f.validations).toHaveBeenCalledOnce()
      expect(f.commits).not.toHaveBeenCalled()
      expect(f.source.name).toBe('Alice')
      if (change === 'dispose') expect(f.model.getActive()).toBeNull()
      else expect(f.model.session('2::name')).toMatchObject({ draft: 'Bob', error: null })
    },
  )

  it('supports async direct editing without a source snapshot or optional adapter transforms', async () => {
    const gate = deferred()
    const f = fixture({ getRows: () => [], findRow: undefined, validate: () => gate.promise })
    f.model.begin(f.source, 3)
    expect(f.model.session('1::name')?.draft).toBe('Alice')
    f.model.setDraft('1::name', 'Alicia')
    f.model.commit('1::name')
    gate.resolve(null)
    await flushValidation()
    expect(f.commits).toHaveBeenCalledExactlyOnceWith({
      rowKey: 1,
      row: f.source,
      column: 'name',
      rowIndex: 3,
      oldValue: 'Alice',
      newValue: 'Alicia',
    })
    expect(f.model.getActive()).toBeNull()
  })
})
