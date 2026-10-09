import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGridEditingModel,
  type GridEditingBindings,
  type GridEditingFeatureOptions,
  type GridEditingModel,
  type GridRowsCommitOptions,
} from './grid'

type Row = { id: number; name: string }
const models: GridEditingModel[] = []
afterEach(() => {
  for (const model of models.splice(0)) model.destroy()
})

function setup(
  options: Partial<GridEditingFeatureOptions<Row>> = {},
  bindings: Partial<GridEditingBindings<Row>> = {},
) {
  const row: Row = { id: 1, name: 'Ada' }
  let rows = [row]
  const getRows = () => rows
  const setRows = vi.fn((next: Row[], _options?: GridRowsCommitOptions) => {
    rows = next
    return true
  })
  const onValidation = vi.fn(options.onValidation)
  const onCommit = vi.fn(options.onCommit)
  const onStateChange = vi.fn(options.onStateChange)
  const emitState = vi.fn()
  const emitCommit = vi.fn()
  const model = createGridEditingModel<Row>(
    { ...options, getRowKey: (item) => item.id, onValidation, onCommit, onStateChange },
    { getRows, setRows, ...bindings },
    emitState,
    emitCommit,
  )
  models.push(model)
  return {
    model,
    row,
    getRows,
    setRows,
    onValidation,
    onCommit,
    onStateChange,
    emitState,
    emitCommit,
  }
}

const settle = () => new Promise<void>((done) => setImmediate(done))

describe('grid editing error and transaction boundaries', () => {
  it.each([
    ['throw', new Error('validator failed'), 'validator failed'],
    ['throw', new Error(), 'Value is invalid'],
    ['throw', 'untyped failure', 'Value is invalid'],
    ['reject', new Error('validator failed'), 'validator failed'],
    ['reject', new Error(), 'Value is invalid'],
    ['reject', 'untyped failure', 'Value is invalid'],
  ])('keeps a custom %s failure in the active editor (%s)', async (mode, reason, error) => {
    const { model, setRows, onValidation, onCommit, emitCommit } = setup({
      validate: () => {
        if (mode === 'throw') throw reason
        return Promise.reject(reason)
      },
    })
    expect(model.start(1, 'name', 'changed')).toBe(true)
    expect(model.commitEdit()).toBe(false)
    await vi.waitFor(() => expect(model.getError()).toBe(error))
    expect(model.getEditing()).toEqual({ rowKey: 1, columnKey: 'name' })
    expect(model.getDraft()).toBe('changed')
    expect(onValidation).toHaveBeenCalledWith({
      rowKey: 1,
      columnKey: 'name',
      valid: false,
      commit: true,
      source: 'custom',
    })
    expect(setRows).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    expect(emitCommit).not.toHaveBeenCalled()
  })

  it('reports a resolved custom error and accepts a later valid async draft', async () => {
    const { model, row, getRows, onValidation, onCommit } = setup({
      validate: (value) => Promise.resolve(value === 'Grace' ? null : 'Name rejected'),
    })
    model.start(1, 'name', 'blocked')
    expect(model.commitEdit()).toBe(false)
    await vi.waitFor(() => expect(model.getError()).toBe('Name rejected'))
    expect(getRows()).toEqual([row])
    expect(onValidation).toHaveBeenCalledWith({
      rowKey: 1,
      columnKey: 'name',
      valid: false,
      commit: true,
      source: 'custom',
    })
    model.setDraft('Grace')
    expect(model.commitEdit()).toBe(false)
    await vi.waitFor(() => expect(getRows()[0].name).toBe('Grace'))
    expect(model.getState()).toEqual({ editing: null, draft: '', error: null, validated: 'Grace' })
    expect(onCommit).toHaveBeenCalledWith({
      rowKey: 1,
      columnKey: 'name',
      rowIndex: 0,
      row,
      nextRow: { id: 1, name: 'Grace' },
      oldValue: 'Ada',
      value: 'Grace',
    })
    expect(row.name).toBe('Ada')
  })

  it.each([
    [new Error('rule unavailable'), 'rule unavailable'],
    [new Error(), 'Value is invalid'],
    ['untyped failure', 'Value is invalid'],
  ])('reports rejected edit rules without writing rows (%s)', async (reason, error) => {
    const { model, setRows, onValidation } = setup({
      getRules: () => [{ validator: () => Promise.reject(reason) }],
    })
    model.start(1, 'name', 'changed')
    expect(model.commitEdit()).toBe(false)
    await vi.waitFor(() => expect(model.getError()).toBe(error))
    expect(model.isEditing(1, 'name')).toBe(true)
    expect(onValidation).toHaveBeenCalledWith({
      rowKey: 1,
      columnKey: 'name',
      valid: false,
      commit: true,
      source: 'editRules',
    })
    expect(setRows).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'checks uniqueness after async rules with a mapped getter: %s',
    async (mapped) => {
      let rows: Row[] = [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Lin' },
      ]
      const validate = vi.fn(() => undefined)
      const { model, onValidation } = setup(
        {
          getRules: () => [{ validator: () => Promise.resolve(null) }, { unique: true }],
          getValue: mapped ? (item) => item.name : undefined,
          validate,
        },
        {
          getRows: () => rows,
          setRows: (next) => {
            rows = next
            return true
          },
        },
      )
      model.start(2, 'name', 'Ada')
      expect(model.commitEdit()).toBe(false)
      await vi.waitFor(() => expect(model.getError()).toBe('Value must be unique'))
      expect(rows[1].name).toBe('Lin')
      expect(validate).not.toHaveBeenCalled()
      expect(onValidation).toHaveBeenCalledWith({
        rowKey: 2,
        columnKey: 'name',
        valid: false,
        commit: true,
        source: 'editRules',
      })
      model.setDraft('Grace')
      expect(model.commitEdit()).toBe(false)
      await vi.waitFor(() => expect(rows[1].name).toBe('Grace'))
      expect(model.getValidated()).toBe('Grace')
      expect(onValidation).toHaveBeenCalledWith({
        rowKey: 2,
        columnKey: 'name',
        valid: true,
        commit: true,
        source: 'editRules',
      })
    },
  )

  it('rechecks editability and uses the default error when the source row disappears', () => {
    let editable = true
    const { model, setRows, onValidation } = setup({ isEditable: () => editable })
    model.start(1, 'name')
    editable = false
    model.setDraft('changed')
    expect(model.getError()).toBe('This cell is not editable')
    expect(model.commitEdit()).toBe(false)
    expect(onValidation).toHaveBeenLastCalledWith({
      rowKey: 1,
      columnKey: 'name',
      valid: false,
      commit: true,
      source: 'none',
    })
    setRows([])
    expect(model.commitEdit()).toBe(false)
    expect(model.getError()).toBe('The edited row no longer exists')
    expect(model.getEditing()).toEqual({ rowKey: 1, columnKey: 'name' })
  })

  it('does not resurrect a row removed while an async commit was pending', async () => {
    let resolve!: (error: null) => void
    const pending = new Promise<null>((done) => {
      resolve = done
    })
    const { model, getRows, setRows, onCommit, emitCommit } = setup({ validate: () => pending })
    model.start(1, 'name', 'late')
    expect(model.commitEdit()).toBe(false)
    setRows([])
    setRows.mockClear()
    resolve(null)
    await settle()
    expect(getRows()).toEqual([])
    expect(model.getEditing()).toBeNull()
    expect(model.getValidated()).toBe('late')
    expect(setRows).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
    expect(emitCommit).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'destroy', 'restart'])(
    'drops an async rule commit after %s',
    async (action) => {
      let resolve!: (error: null) => void
      const pending = new Promise<null>((done) => {
        resolve = done
      })
      const { model, row, getRows, setRows, onValidation, onStateChange, emitState, onCommit } =
        setup({
          getRules: () => [{ validator: () => pending }],
        })
      model.start(1, 'name', 'late')
      expect(model.commitEdit()).toBe(false)
      if (action === 'cancel') model.cancelEdit()
      if (action === 'restart') model.start(1, 'name', 'new session')
      if (action === 'destroy') {
        model.destroy()
        const disposed = model.store.getState()
        model.destroy()
        expect(model.store.getState()).toBe(disposed)
      }
      onValidation.mockClear()
      onStateChange.mockClear()
      emitState.mockClear()
      resolve(null)
      await settle()
      expect(getRows()).toEqual([row])
      expect(setRows).not.toHaveBeenCalled()
      expect(onCommit).not.toHaveBeenCalled()
      expect(model.getValidated()).toBeUndefined()
      expect(model.getEditing()).toEqual(
        action === 'restart' ? { rowKey: 1, columnKey: 'name' } : null,
      )
      if (action === 'restart') expect(model.getDraft()).toBe('new session')
      if (action === 'destroy') {
        expect(onValidation).not.toHaveBeenCalled()
        expect(onStateChange).not.toHaveBeenCalled()
        expect(emitState).not.toHaveBeenCalled()
      }
    },
  )

  it('isolates editing targets returned to callbacks and callers', () => {
    const { model, emitState } = setup({
      onStateChange: (state) => {
        if (state.editing) state.editing.rowKey = 99
      },
    })
    expect(model.getEditing()).toBeNull()
    model.startEdit(1, 'name', 'explicit draft')
    const target = model.getEditing()!
    const snapshot = model.getState()
    target.columnKey = 'id'
    snapshot.editing!.rowKey = 99
    expect(model.getEditing()).toEqual({ rowKey: 1, columnKey: 'name' })
    expect(model.getDraft()).toBe('explicit draft')
    expect(emitState).toHaveBeenCalledWith({
      editing: { rowKey: 1, columnKey: 'name' },
      draft: 'explicit draft',
      error: null,
      validated: undefined,
    })
    model.cancelEdit()
    expect(model.getEditing()).toBeNull()
  })

  it.each(['same row', 'rejected write'])('suppresses commit notifications for a %s', (mode) => {
    const rejected = vi.fn(() => false)
    const { model, row, getRows, setRows, onCommit, emitCommit } = setup(
      { setValue: mode === 'same row' ? (item) => item : undefined },
      mode === 'rejected write' ? { setRows: rejected } : {},
    )
    model.start(1, 'name', 'changed')
    expect(model.commitEdit()).toBe(true)
    expect(model.getEditing()).toBeNull()
    expect(getRows()).toEqual([row])
    expect(row.name).toBe('Ada')
    expect(setRows).not.toHaveBeenCalled()
    if (mode === 'rejected write') {
      expect(rejected).toHaveBeenCalledWith([{ id: 1, name: 'changed' }], { reason: 'cell-edit' })
    }
    expect(onCommit).not.toHaveBeenCalled()
    expect(emitCommit).not.toHaveBeenCalled()
  })

  it('requires a path setter for nested rows when there is no root index', () => {
    const child = { id: 2, name: 'Child' }
    const { model, row, getRows, setRows, onCommit } = setup({}, { findRow: () => child })
    expect(model.start(2, 'name', 'changed')).toBe(true)
    expect(model.commitEdit()).toBe(true)
    expect(getRows()).toEqual([row])
    expect(Object.hasOwn(getRows(), '-1')).toBe(false)
    expect(child.name).toBe('Child')
    expect(setRows).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('forwards dynamic transaction options and marks nested commits without a visible index', () => {
    const child = { id: 2, name: 'Child' }
    const meta = { origin: 'editor' }
    const setRow = vi.fn<NonNullable<GridEditingBindings<Row>['setRow']>>(() => true)
    const { model, setRows, onCommit } = setup(
      { commitOptions: () => ({ reason: 'nested-edit', meta }) },
      { findRow: () => child, setRow },
    )
    model.start(2, 'name', 'changed')
    expect(model.commitEdit()).toBe(true)
    expect(setRow).toHaveBeenCalledWith(2, { id: 2, name: 'changed' }, child, {
      reason: 'nested-edit',
      meta,
    })
    expect(setRow.mock.calls[0]?.[3]?.meta).toBe(meta)
    expect(setRows).not.toHaveBeenCalled()
    expect(onCommit).toHaveBeenCalledWith({
      rowKey: 2,
      columnKey: 'name',
      rowIndex: -1,
      row: child,
      nextRow: { id: 2, name: 'changed' },
      oldValue: 'Child',
      value: 'changed',
    })
  })
})
