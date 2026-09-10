import { describe, expect, it } from 'vitest'
import { createTableRowEditModel } from './table-row-edit'
import { columns, makeModel, type Column, type Row } from './table-row-edit.test-support'

describe('createTableRowEditModel', () => {
  it('owns sync validation, draft transitions, coercion, source identity, and row indexes', () => {
    const required: Column[] = [
      { key: 'name', editable: true, editRules: [{ required: true }] },
      { key: 'age', editable: true },
    ]
    const sourceRows: Row[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ]
    const { model, commits } = makeModel(required, sourceRows)
    const source = sourceRows[0]!

    expect(model.begin(source, 7)).toBe(true)
    expect(model.getState().active).toEqual({ key: 1, index: 7 })
    expect(model.session('1::name')?.row).toBe(source)
    expect(model.session('1::name')?.draft).toBe('Alice')

    model.setDraft('1::name', '')
    expect(model.commit('1::name')).toBe(false)
    expect(model.session('1::name')?.error).toBe('This field is required')
    expect(commits).toHaveLength(0)

    model.setDraft('1::name', 'Alicia')
    expect(model.commit('1::name')).toBe(true)
    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({
      rowKey: 1,
      row: source,
      rowIndex: 7,
      oldValue: 'Alice',
      newValue: 'Alicia',
    })

    model.setDraft('1::age', '42')
    expect(model.commit('1::age')).toBe(true)
    expect(commits[1]).toMatchObject({
      row: source,
      column: { key: 'age' },
      oldValue: 30,
      newValue: 42,
      rowIndex: 7,
    })
    expect(typeof commits[1]!.newValue).toBe('number')
  })

  it('reports current validation attempts while only landed changes commit', () => {
    const validation: Array<{ valid: boolean; commit: true }> = []
    const required: Column[] = [
      { key: 'name', editable: true, editRules: [{ required: true }] },
      { key: 'age', editable: true },
    ]
    const { model, commits } = makeModel(required, undefined, (result) => {
      validation.push({ valid: result.valid, commit: result.commit })
    })
    const source = { id: 1, name: 'Alice', age: 30 }
    model.begin(source, 0)

    model.setDraft('1::name', '')
    expect(model.commit('1::name')).toBe(false)
    expect(validation).toEqual([{ valid: false, commit: true }])
    expect(commits).toHaveLength(0)

    model.setDraft('1::name', 'Alicia')
    expect(model.commit('1::name')).toBe(true)
    expect(validation).toEqual([
      { valid: false, commit: true },
      { valid: true, commit: true },
    ])
    expect(commits).toHaveLength(1)

    // A valid no-op is still a validation attempt, but not a landed commit.
    model.begin(source, 0)
    expect(model.commit('1::name')).toBe(true)
    expect(validation).toHaveLength(3)
    expect(commits).toHaveLength(1)
  })

  it('keeps no-op commits silent and repeated closed-cell commits harmless', () => {
    const { model, commits } = makeModel()
    model.begin({ id: 1, name: 'Alice', age: 30 }, 0)

    expect(model.commit('1::name')).toBe(true)
    expect(model.commit('1::name')).toBe(true)
    expect(commits).toHaveLength(0)
    expect(model.session('1::name')).toBeUndefined()
  })

  it('does not fall back to getRows when an explicit findRow misses', () => {
    const source: Row = { id: 1, name: 'Alice', age: 30 }
    const model = createTableRowEditModel<Row, Column>({
      getColumns: () => [{ key: 'name', editable: true }],
      getRows: () => [source],
      isEditable: (column) => column.editable === true,
      getColumnKey: (column) => column.key,
      getRowKey: (row) => row.id,
      getCellValue: (row, column) => row[column.key],
      findRow: () => undefined,
    })

    expect(model.begin(source, 0)).toBe(false)
    expect(model.getActive()).toBeNull()
  })

  it('rechecks row-scoped editability at commit time', () => {
    let editable = true
    const source: Row = { id: 1, name: 'Alice', age: 30 }
    const commits: unknown[] = []
    const model = createTableRowEditModel<Row, Column>({
      getColumns: () => [{ key: 'name', editable: true }],
      getRows: () => [source],
      isEditable: (column, row) => column.editable === true && row === source && editable,
      getColumnKey: (column) => column.key,
      getRowKey: (row) => row.id,
      getCellValue: (row, column) => row[column.key],
      findRow: () => source,
      onCommit: (commit) => commits.push(commit),
    })

    expect(model.begin(source, 0)).toBe(true)
    model.setDraft('1::name', 'Alicia')
    editable = false

    expect(model.commit('1::name')).toBe(false)
    expect(model.session('1::name')?.error).toBe('This cell is not editable')
    expect(commits).toHaveLength(0)
  })

  it('marks custom validation failures separately from editRules', () => {
    const validations: Array<{ valid: boolean; source: string }> = []
    const required: Column[] = [{ key: 'name', editable: true, editRules: [{ required: true }] }]
    const { model, commits } = makeModel(
      required,
      undefined,
      (validation) => validations.push({ valid: validation.valid, source: validation.source }),
      (value) => (value === 'allowed' ? null : 'custom failure'),
    )
    model.begin({ id: 1, name: 'Alice', age: 30 }, 0)
    model.setDraft('1::name', 'blocked')
    expect(model.commit('1::name')).toBe(false)
    expect(validations.at(-1)).toEqual({ valid: false, source: 'custom' })
    expect(commits).toHaveLength(0)

    model.setDraft('1::name', 'allowed')
    expect(model.commit('1::name')).toBe(true)
    expect(validations.at(-1)).toEqual({ valid: true, source: 'editRules' })
    expect(commits).toHaveLength(1)
  })

  it('runs unique through the current column value resolver', () => {
    const aliasRows: Array<{ id: number; name: string; displayName?: string }> = [
      { id: 1, name: 'Alice', displayName: 'A' },
      { id: 2, name: 'Bob', displayName: 'B' },
    ]
    const aliasColumns: Column[] = [
      { key: 'displayName', editable: true, editRules: [{ unique: true }] },
    ]
    const model = createTableRowEditModel<(typeof aliasRows)[number], Column>({
      getColumns: () => aliasColumns,
      getRows: () => aliasRows,
      isEditable: (column) => column.editable === true,
      getColumnKey: (column) => column.key,
      getRowKey: (row) => row.id,
      getCellValue: (row) => row.name,
      getEditRules: (column) => column.editRules,
      findRow: (key) => aliasRows.find((row) => row.id === key),
      onCommit: () => undefined,
    })
    model.begin(aliasRows[1]!, 1)
    model.setDraft('2::displayName', 'Alice')
    expect(model.commit('2::displayName')).toBe(false)
    expect(model.session('2::displayName')?.error).toBe('Value must be unique')
  })

  it('supports observing immutable row-session snapshots', () => {
    const { model } = makeModel()
    const states = [] as Array<ReturnType<typeof model.getState>>
    const unsubscribe = model.store.subscribe((state) => states.push(state))
    const source = { id: 1, name: 'Alice', age: 30 }
    model.begin(source, 0)
    model.setDraft('1::name', 'Alicia')
    model.cancelAll()
    unsubscribe()

    expect(states.length).toBeGreaterThanOrEqual(3)
    expect(states[0]!.sessions).not.toBe(states.at(-1)!.sessions)
    expect(states.at(-1)!.active).toBeNull()
  })

  it('does not require an onCommit callback', () => {
    const { model } = makeModel()
    const noCallbackModel = createTableRowEditModel<Row, Column>({
      getColumns: () => columns,
      getRows: () => [],
      isEditable: () => true,
      getColumnKey: (column) => column.key,
      getRowKey: (row) => row.id,
      getCellValue: (row, column) => row[column.key],
    })
    expect(noCallbackModel.begin({ id: 3, name: 'C', age: 1 }, 0)).toBe(true)
    expect(noCallbackModel.commit('3::name')).toBe(true)
    // Keep the primary fixture exercised as well; this is a no-op assertion,
    // not a second write-back path.
    expect(model.getActive()).toBeNull()
  })
})
