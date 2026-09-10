import { describe, expect, it } from 'vitest'
import { createTableRowEditModel } from './table-row-edit'
import {
  columns,
  flushAsyncValidation,
  makeModel,
  type Column,
  type Row,
} from './table-row-edit.test-support'

describe('createTableRowEditModel', () => {
  it('fails closed when an explicit findRow reports a removed row', async () => {
    const resolveRule: { current?: (message: string | null) => void } = {}
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRule.current = resolve
              }),
          },
        ],
      },
    ]
    const sourceRows: Row[] = [{ id: 1, name: 'Alice', age: 30 }]
    const { model, commits, replaceRows } = makeModel(asyncColumns, sourceRows)
    model.begin(sourceRows[0]!, 0)
    model.setDraft('1::name', 'Alicia')
    expect(model.commit('1::name')).toBe(true)

    replaceRows([])
    resolveRule.current!(null)
    await flushAsyncValidation()

    expect(commits).toHaveLength(0)
    expect(model.session('1::name')?.error).toBe('The edited row no longer exists')
  })

  it('drops a late valid result when the keyed source row was replaced', async () => {
    const resolveRule: { current?: (message: string | null) => void } = {}
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRule.current = resolve
              }),
          },
        ],
      },
    ]
    const source = { id: 1, name: 'Alice', age: 30 }
    const { model, commits, replaceRows } = makeModel(asyncColumns, [source])
    model.begin(source, 0)
    model.setDraft('1::name', 'Alicia')
    model.commit('1::name')

    replaceRows([{ id: 1, name: 'Fresh source', age: 31 }])
    resolveRule.current!(null)
    await flushAsyncValidation()

    expect(commits).toHaveLength(0)
    expect(model.session('1::name')?.error).toBe('The edited row no longer exists')
  })

  it('does not write a detached success after its validation observer cancels', async () => {
    const sourceRows: Row[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const rows = sourceRows
    let resolveRule!: (message: string | null) => void
    const commits: unknown[] = []
    const asyncColumn: Column = {
      key: 'name',
      editable: true,
      editRules: [
        {
          validator: () =>
            new Promise<string | null>((resolve) => {
              resolveRule = resolve
            }),
        },
      ],
    }
    const cancelModel: { current?: () => void } = {}
    const model = createTableRowEditModel<Row, Column>({
      getColumns: () => [asyncColumn],
      getRows: () => rows,
      isEditable: (column) => column.editable === true,
      getColumnKey: (column) => column.key,
      getRowKey: (row) => row.id,
      getCellValue: (row, column) => row[column.key],
      getEditRules: (column) => column.editRules,
      findRow: (key) => rows.find((row) => row.id === key),
      onValidation: (validation) => {
        if (validation.valid) cancelModel.current?.()
      },
      onCommit: (commit) => commits.push(commit),
    })
    cancelModel.current = () => model.cancelAll()

    model.begin(sourceRows[0]!, 0)
    model.setDraft('1::name', 'Alicia')
    expect(model.commit('1::name')).toBe(true)
    expect(model.switch(sourceRows[1]!, 1)).toBe(true)

    resolveRule(null)
    await flushAsyncValidation()

    expect(commits).toHaveLength(0)
    expect(model.getActive()).toBeNull()
  })

  it('rechecks row editability after an async validation settles', async () => {
    let editable = true
    let resolveRule!: (message: string | null) => void
    const source: Row = { id: 1, name: 'Alice', age: 30 }
    const commits: unknown[] = []
    const column: Column = {
      key: 'name',
      editable: true,
      editRules: [
        {
          validator: () =>
            new Promise<string | null>((resolve) => {
              resolveRule = resolve
            }),
        },
      ],
    }
    const model = createTableRowEditModel<Row, Column>({
      getColumns: () => [column],
      getRows: () => [source],
      isEditable: (candidate, row) => candidate.editable === true && row === source && editable,
      getColumnKey: (candidate) => candidate.key,
      getRowKey: (row) => row.id,
      getCellValue: (row, candidate) => row[candidate.key],
      getEditRules: (candidate) => candidate.editRules,
      findRow: () => source,
      onCommit: (commit) => commits.push(commit),
    })

    expect(model.begin(source, 0)).toBe(true)
    model.setDraft('1::name', 'Alicia')
    expect(model.commit('1::name')).toBe(true)
    editable = false
    resolveRule(null)
    await flushAsyncValidation()

    expect(model.session('1::name')?.error).toBe('This cell is not editable')
    expect(commits).toHaveLength(0)
  })

  it('does not invoke a pending validator twice, while a new draft can retry', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const validatorCalls: unknown[] = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: (value) =>
              new Promise<string | null>((resolve) => {
                validatorCalls.push(value)
                resolvers.push(resolve)
              }),
          },
        ],
      },
    ]
    const validations: Array<{ valid: boolean; source: string }> = []
    const { model, commits } = makeModel(asyncColumns, undefined, (validation) => {
      validations.push({ valid: validation.valid, source: validation.source })
    })
    model.begin({ id: 1, name: 'Alice', age: 30 }, 0)
    model.setDraft('1::name', 'first')
    expect(model.commit('1::name')).toBe(true)
    expect(model.commit('1::name')).toBe(true)
    expect(validatorCalls).toEqual(['first'])

    model.setDraft('1::name', 'second')
    expect(model.commit('1::name')).toBe(true)
    expect(validatorCalls).toEqual(['first', 'second'])

    resolvers[0]!('stale attempt')
    await flushAsyncValidation()
    expect(commits).toHaveLength(0)
    expect(validations).toHaveLength(0)
    resolvers[1]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(1)
    expect(validations).toEqual([{ valid: true, source: 'editRules' }])
    expect(commits[0]!.newValue).toBe('second')
  })

  it('reports detached editRules failures once with their validation source', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const validations: Array<{ valid: boolean; commit: true; source: string }> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
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
    ]
    const sourceRows: Row[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const { model } = makeModel(asyncColumns, sourceRows, (validation) => {
      validations.push({
        valid: validation.valid,
        commit: validation.commit,
        source: validation.source,
      })
    })
    model.begin(sourceRows[0]!, 0)
    model.setDraft('1::name', 'Alicia')
    model.commit('1::name')
    expect(model.switch(sourceRows[1]!, 1)).toBe(true)

    resolvers[0]!('stale')
    await flushAsyncValidation()

    expect(validations).toEqual([{ valid: false, commit: true, source: 'editRules' }])
  })

  it('preserves a valid switched-away commit only for the original source row', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
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
    ]
    const sourceRows: Row[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const { model, commits, replaceRows } = makeModel(asyncColumns, sourceRows)
    model.begin(sourceRows[0]!, 0)
    model.setDraft('1::name', 'Alicia')
    model.commit('1::name')
    expect(model.switch(sourceRows[1]!, 1)).toBe(true)
    replaceRows([{ id: 1, name: 'Fresh', age: 31 }, sourceRows[1]!])
    resolvers[0]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(0)
  })

  it('runs async declarative rules once per attempt and drops stale draft results', async () => {
    const resolveRules: Array<(message: string | null) => void> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: (value) =>
              new Promise<string | null>((resolve) => {
                resolveRules.push(() => resolve(value === 'ok' ? null : 'must be ok'))
              }),
          },
        ],
      },
      { key: 'age', editable: true },
    ]
    const { model, commits } = makeModel(asyncColumns)
    model.begin({ id: 1, name: 'Alice', age: 30 }, 0)
    model.setDraft('1::name', 'first')
    expect(model.commit('1::name')).toBe(true)
    model.setDraft('1::name', 'ok')
    expect(model.commit('1::name')).toBe(true)
    expect(resolveRules).toHaveLength(2)

    resolveRules[0]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(0)
    expect(model.session('1::name')?.draft).toBe('ok')

    resolveRules[1]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(1)
    expect(commits[0]!.newValue).toBe('ok')
  })

  it('keeps the active cell open on an async rule failure, then accepts a later pass', async () => {
    const resolveRules: Array<(message: string | null) => void> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRules.push(resolve)
              }),
          },
        ],
      },
    ]
    const { model, commits } = makeModel(asyncColumns)
    model.begin({ id: 1, name: 'Alice', age: 30 }, 4)

    model.setDraft('1::name', 'bad')
    expect(model.commit('1::name')).toBe(true)
    resolveRules[0]!('not valid')
    await flushAsyncValidation()
    expect(model.session('1::name')?.error).toBe('not valid')
    expect(commits).toHaveLength(0)

    model.setDraft('1::name', 'good')
    expect(model.commit('1::name')).toBe(true)
    resolveRules[1]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(1)
    expect(commits[0]!.rowIndex).toBe(4)
  })

  it('invalidates pending validations when switching rows', async () => {
    const resolveRules: Array<(message: string | null) => void> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRules.push(resolve)
              }),
          },
        ],
      },
    ]
    const sourceRows: Row[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const { model, commits } = makeModel(asyncColumns, sourceRows)
    model.begin(sourceRows[0]!, 3)
    model.setDraft('1::name', 'Alicia')
    expect(model.commit('1::name')).toBe(true)

    expect(model.switch(sourceRows[1]!, 9)).toBe(true)
    expect(model.getActive()).toEqual({ key: 2, index: 9 })
    resolveRules[0]!('stale')
    await flushAsyncValidation()

    expect(commits).toHaveLength(0)
    expect(model.session('2::name')?.error).toBeNull()
  })

  it('lands a valid switched-away commit on the original source row', async () => {
    const resolveRules: Array<(message: string | null) => void> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRules.push(resolve)
              }),
          },
        ],
      },
    ]
    const sourceRows: Row[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const { model, commits } = makeModel(asyncColumns, sourceRows)
    model.begin(sourceRows[0]!, 3)
    model.setDraft('1::name', 'Alicia')
    model.commit('1::name')
    expect(model.switch(sourceRows[1]!, 9)).toBe(true)

    for (const resolve of resolveRules) resolve(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({
      rowKey: 1,
      row: sourceRows[0],
      rowIndex: 3,
      oldValue: 'Alice',
      newValue: 'Alicia',
    })
  })

  it('cancels pending validation on cancelAll and dispose, including late results', async () => {
    const resolveRules: Array<(message: string | null) => void> = []
    const asyncColumns: Column[] = [
      {
        key: 'name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRules.push(resolve)
              }),
          },
        ],
      },
    ]
    const { model, commits } = makeModel(asyncColumns)
    const source = { id: 1, name: 'Alice', age: 30 }
    model.begin(source, 0)
    model.setDraft('1::name', 'cancelled')
    model.commit('1::name')
    model.cancelAll()
    resolveRules[0]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(0)
    expect(model.getActive()).toBeNull()

    model.begin(source, 0)
    model.setDraft('1::name', 'disposed')
    model.commit('1::name')
    model.dispose()
    model.dispose()
    resolveRules[1]!(null)
    await flushAsyncValidation()
    expect(commits).toHaveLength(0)
    expect(model.commit('1::name')).toBe(false)
  })

  it('does not mutate the source rows while the model owns drafts', () => {
    const source = { id: 1, name: 'Alice', age: 30 }
    const { model, replaceRows, commits } = makeModel(columns, [source])
    model.begin(source, 0)
    model.setDraft('1::name', 'Draft only')
    expect(source).toEqual({ id: 1, name: 'Alice', age: 30 })
    const fresh = { id: 1, name: 'Fresh source', age: 31 }
    replaceRows([fresh])
    model.setDraft('1::name', 'Fresh draft')
    expect(model.commit('1::name')).toBe(true)
    expect(commits[0]!.row).toBe(fresh)
  })
})
