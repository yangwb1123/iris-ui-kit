import { describe, expect, it } from 'vitest'
import { createRoot } from 'solid-js'
import { createTableRowEditController, type RowCellSession } from './table-row-edit'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  amount: number
}

type Bridge = ReturnType<typeof makeBridge>

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', editable: true },
  { key: 'amountLabel', dataIndex: 'amount', title: 'Amount', editable: true, editor: 'number' },
]

function makeBridge(
  configuredColumns: IrisTableColumn<Row>[] = columns,
  initialRows: Row[] = [
    { id: 1, name: 'Alice', amount: 10 },
    { id: 2, name: 'Bob', amount: 20 },
  ],
) {
  let rows = initialRows
  const commits: Array<{
    rowKey: string | number
    row: Row
    column: IrisTableColumn<Row>
    rowIndex: number
    oldValue: unknown
    newValue: unknown
  }> = []
  let controller!: ReturnType<typeof createTableRowEditController<Row>>
  const dispose = createRoot((disposeRoot) => {
    controller = createTableRowEditController<Row>({
      getColumns: () => configuredColumns,
      getRows: () => rows,
      findRow: (key) => rows.find((row) => row.id === key),
      getRowId: (row) => row.id,
      getCellValue: (row, column) => row[(column.dataIndex ?? column.key) as keyof Row],
      writeCellValue: (commit) => {
        commits.push(commit)
        const valueKey = (commit.column.dataIndex ?? commit.column.key) as keyof Row
        rows = rows.map((row) =>
          row === commit.row ? { ...row, [valueKey]: commit.newValue } : row,
        )
      },
    })
    return disposeRoot
  })
  return {
    controller,
    commits,
    get rows() {
      return rows
    },
    dispose,
  }
}

function session(bridge: Bridge, id: string): RowCellSession<Row> {
  const value = bridge.controller.rowSessions().get(id)
  expect(value).toBeDefined()
  return value!
}

async function flushValidation(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('Solid table row-edit bridge', () => {
  it('projects the active/session shapes and keeps sync editRules failures visible', () => {
    const bridge = makeBridge([
      { key: 'name', title: 'Name', editable: true, editRules: [{ required: true }] },
    ])
    try {
      const source = bridge.rows[0]!
      bridge.controller.beginRowEdit(source, 7)
      expect(bridge.controller.rowEditing()).toEqual({ k: 1, idx: 7 })

      const name = session(bridge, '1::name')
      expect(name.col.key).toBe('name')
      expect(name.rowIndex).toBe(7)
      expect(name.draft()).toBe('Alice')
      bridge.controller.setDraft('1::name', '')
      expect(bridge.controller.commitRowSession(name, source, 1)).toBe(false)
      expect(name.error()).toBe('This field is required')
      expect(bridge.commits).toHaveLength(0)

      bridge.controller.setDraft('1::name', 'Alicia')
      expect(bridge.controller.commitRowSession(name, source, 1)).toBe(true)
      expect(bridge.controller.rowSessions().has('1::name')).toBe(false)
      expect(bridge.commits[0]).toMatchObject({
        row: source,
        rowKey: 1,
        rowIndex: 7,
        oldValue: 'Alice',
        newValue: 'Alicia',
      })
    } finally {
      bridge.dispose()
    }
  })

  it('drops stale drafts, preserves switched-away valid commits, and ignores stale failures', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const asyncColumns: IrisTableColumn<Row>[] = [
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
    ]
    const bridge = makeBridge(asyncColumns)
    try {
      const first = bridge.rows[0]!
      bridge.controller.beginRowEdit(first, 3)
      const name = session(bridge, '1::name')
      bridge.controller.setDraft('1::name', 'first')
      expect(bridge.controller.commitRowSession(name, first, 1)).toBe(true)
      bridge.controller.setDraft('1::name', 'second')
      resolvers[0]!(null)
      await flushValidation()
      expect(bridge.commits).toHaveLength(0)
      expect(name.error()).toBeNull()

      expect(bridge.controller.commitRowSession(name, first, 1)).toBe(true)
      expect(resolvers).toHaveLength(2)
      resolvers[1]!(null)
      await flushValidation()
      expect(bridge.commits).toHaveLength(1)
      expect(bridge.commits[0]!.newValue).toBe('second')

      const currentFirst = bridge.rows[0]!
      bridge.controller.beginRowEdit(currentFirst, 3)
      const switched = session(bridge, '1::name')
      bridge.controller.setDraft('1::name', 'landed')
      bridge.controller.commitRowSession(switched, first, 1)
      const second = bridge.rows[1]!
      bridge.controller.switchRowEdit(second, 9)
      expect(bridge.controller.rowEditing()).toEqual({ k: 2, idx: 9 })
      expect(resolvers).toHaveLength(3)
      resolvers[2]!(null)
      await flushValidation()
      expect(bridge.commits[1]).toMatchObject({
        row: currentFirst,
        rowKey: 1,
        rowIndex: 3,
        newValue: 'landed',
      })

      bridge.controller.beginRowEdit(second, 9)
      const stale = session(bridge, '2::name')
      bridge.controller.setDraft('2::name', 'rejected')
      bridge.controller.commitRowSession(stale, second, 2)
      bridge.controller.switchRowEdit(first, 3)
      expect(resolvers).toHaveLength(4)
      resolvers[3]!('stale')
      await flushValidation()
      expect(bridge.commits).toHaveLength(2)
      expect(bridge.controller.rowEditing()).toEqual({ k: 1, idx: 3 })
    } finally {
      bridge.dispose()
    }
  })

  it('ignores a stale session callback after a same-id session is reopened', () => {
    const bridge = makeBridge()
    try {
      const source = bridge.rows[0]!
      bridge.controller.beginRowEdit(source, 0)
      const oldSession = session(bridge, '1::name')
      expect(bridge.controller.commitRowSession(oldSession, source, 1)).toBe(true)

      bridge.controller.beginRowEdit(source, 0)
      const reopened = session(bridge, '1::name')
      bridge.controller.setDraft('1::name', 'reopened')
      expect(bridge.controller.commitRowSession(oldSession, source, 1)).toBe(true)
      expect(bridge.commits).toHaveLength(0)
      expect(bridge.controller.commitRowSession(reopened, source, 1)).toBe(true)
      expect(bridge.commits).toHaveLength(1)
      expect(bridge.commits[0]!.newValue).toBe('reopened')
    } finally {
      bridge.dispose()
    }
  })

  it('does not reuse a projection when begin replaces an open same-id row session', () => {
    const bridge = makeBridge()
    try {
      const source = bridge.rows[0]!
      bridge.controller.beginRowEdit(source, 0)
      const stale = session(bridge, '1::name')

      bridge.controller.beginRowEdit(source, 0)
      const replacement = session(bridge, '1::name')
      bridge.controller.setDraft('1::name', 'replacement')

      expect(replacement).not.toBe(stale)
      bridge.controller.cancelRowEdit(stale)
      expect(bridge.controller.rowEditing()).toEqual({ k: 1, idx: 0 })
      expect(bridge.controller.commitRowSession(stale, source, 1)).toBe(true)
      expect(bridge.commits).toHaveLength(0)
      expect(bridge.controller.commitRowSession(replacement, source, 1)).toBe(true)
      expect(bridge.commits).toHaveLength(1)
      expect(bridge.commits[0]!.newValue).toBe('replacement')
    } finally {
      bridge.dispose()
    }
  })

  it('cancels and disposes pending validations, including late results and stale blur', async () => {
    const resolvers: Array<(message: string | null) => void> = []
    const asyncColumns: IrisTableColumn<Row>[] = [
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
    ]
    const bridge = makeBridge(asyncColumns)
    const source = bridge.rows[0]!
    bridge.controller.beginRowEdit(source, 0)
    const pending = session(bridge, '1::name')
    bridge.controller.setDraft('1::name', 'cancelled')
    bridge.controller.commitRowSession(pending, source, 1)
    bridge.controller.cancelRowEdit()
    expect(bridge.controller.rowEditing()).toBeNull()
    expect(bridge.controller.commitRowSession(pending, source, 1)).toBe(true)
    resolvers[0]!(null)
    await flushValidation()
    expect(bridge.commits).toHaveLength(0)

    const disposedBridge = makeBridge(asyncColumns)
    const disposedSource = disposedBridge.rows[0]!
    disposedBridge.controller.beginRowEdit(disposedSource, 0)
    const disposed = session(disposedBridge, '1::name')
    disposedBridge.controller.setDraft('1::name', 'disposed')
    disposedBridge.controller.commitRowSession(disposed, disposedSource, 1)
    disposedBridge.dispose()
    resolvers[1]!(null)
    await flushValidation()
    expect(disposedBridge.commits).toHaveLength(0)
    bridge.dispose()
  })

  it('coerces numbers through dataIndex, preserves current row identity, and silences no-ops', () => {
    const bridge = makeBridge()
    try {
      const source = bridge.rows[0]!
      bridge.controller.beginRowEdit(source, 12)
      const amount = session(bridge, '1::amountLabel')
      expect(amount.draft()).toBe('10')
      bridge.controller.setDraft('1::amountLabel', '42')
      expect(bridge.controller.commitRowSession(amount, source, 1)).toBe(true)
      expect(bridge.commits[0]).toMatchObject({
        row: source,
        oldValue: 10,
        newValue: 42,
        rowIndex: 12,
      })
      expect(typeof bridge.commits[0]!.newValue).toBe('number')
      expect(bridge.rows[0]).not.toBe(source)
      expect(bridge.rows[0]!.amount).toBe(42)
      expect(bridge.rows[0]!.amountLabel).toBeUndefined()

      bridge.controller.beginRowEdit(bridge.rows[0]!, 12)
      const noOp = session(bridge, '1::amountLabel')
      expect(bridge.controller.commitRowSession(noOp, bridge.rows[0]!, 1)).toBe(true)
      expect(bridge.commits).toHaveLength(1)
    } finally {
      bridge.dispose()
    }
  })
})
