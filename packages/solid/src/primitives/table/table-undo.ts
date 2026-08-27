import { createEffect, createSignal, type Accessor } from 'solid-js'
import { createUndoStack, type AuditLogType, type UndoStack } from '@iris-ui-kit/core'
import { createUndoKeydownHandler, registerScopedKeydownListener } from './table-shortcut'

type TableRow = Record<string, unknown>

export interface TableUndoSelectionContext<Row extends TableRow = TableRow> {
  current: () => Array<string | number>
  enabled: () => boolean
  keyOf: (row: Row, index: number) => string | number
  rebase: () => void
  set: (keys: Array<string | number>) => void
}

export interface TableUndoContext<Row extends TableRow = TableRow> {
  enabled: () => boolean
  initialRows: () => Row[]
  sourceRows: () => Row[]
  setRows: (rows: Row[]) => void
  onDataChange: (rows: Row[]) => void
  root: () => HTMLElement | undefined
  isEditing: () => boolean
  selection: TableUndoSelectionContext<Row>
}

export interface TableUndoController<Row extends TableRow = TableRow> {
  stack: UndoStack<Row[]>
  canUndo: Accessor<boolean>
  canRedo: Accessor<boolean>
  record: (rows: Row[]) => void
  commit: (rows: Row[], type?: AuditLogType) => void
  undo: () => void
  redo: () => void
  handleKeydown: (event: KeyboardEvent) => void
}

function sameRowList(a: TableRow[], b: TableRow[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((row, index) => row === b[index])
}

/** Solid bridge for the framework-free post-change row-list undo stack. */
export function createTableUndoController<Row extends TableRow = TableRow>(
  enabled: TableUndoContext<Row>['enabled'],
  initialRows: TableUndoContext<Row>['initialRows'],
  sourceRows: TableUndoContext<Row>['sourceRows'],
  setRows: TableUndoContext<Row>['setRows'],
  onDataChange: TableUndoContext<Row>['onDataChange'],
  root: TableUndoContext<Row>['root'],
  isEditing: TableUndoContext<Row>['isEditing'],
  selection: TableUndoSelectionContext<Row>,
): TableUndoController<Row> {
  const stack = createUndoStack<Row[]>({
    maxHistory: 100,
    initial: [...(initialRows() ?? [])],
    equals: sameRowList,
  })
  const [revision, setRevision] = createSignal(0)
  let restoring = false
  let lastSource = sourceRows()
  let wasEnabled = enabled()

  const bump = (): void => {
    setRevision((value) => value + 1)
  }
  const record = (rows: Row[]): void => {
    if (!enabled() || restoring) return
    stack.push([...(rows ?? [])])
    bump()
  }
  const commit = (rows: Row[], _type: AuditLogType = 'edit'): void => {
    record(rows)
    setRows(rows)
    onDataChange(rows)
  }

  const canUndo = (): boolean => {
    revision()
    return enabled() && !isEditing() && stack.canUndo()
  }
  const canRedo = (): boolean => {
    revision()
    return enabled() && !isEditing() && stack.canRedo()
  }

  // A new parent/proxy source becomes the baseline only while history is still
  // pristine. Once a user mutation exists, interaction history is retained.
  createEffect(() => {
    const next = sourceRows()
    const nextEnabled = enabled()
    if (next !== lastSource) {
      lastSource = next
      if (nextEnabled && !stack.canUndo() && !stack.canRedo()) {
        stack.clear()
        stack.push([...(next ?? [])])
        bump()
      }
    }
    if (nextEnabled && !wasEnabled) {
      stack.clear()
      // If the feature is enabled after an edit made while it was off, the
      // live adapter copy (rather than the unchanged parent source) is the
      // baseline. This keeps opt-in toggles from manufacturing an undo step.
      stack.push([...(initialRows() ?? [])])
      bump()
    }
    wasEnabled = nextEnabled
  })

  const replay = (rows: Row[] | undefined, type: AuditLogType): void => {
    if (rows === undefined) return
    const before = selection.current()
    if (selection.enabled() && before.length > 0) {
      const keys = new Set<string | number>()
      rows.forEach((row, index) => keys.add(selection.keyOf(row, index)))
      const kept = before.filter((key) => keys.has(key))
      if (kept.length !== before.length) {
        selection.rebase()
        selection.set(kept)
      }
    }
    restoring = true
    try {
      commit(rows, type)
    } finally {
      restoring = false
    }
  }

  const undo = (): void => {
    if (!enabled() || isEditing()) return
    const rows = stack.undo()
    if (rows !== undefined) {
      bump()
      replay(rows, 'undo')
    }
  }
  const redo = (): void => {
    if (!enabled() || isEditing()) return
    const rows = stack.redo()
    if (rows !== undefined) {
      bump()
      replay(rows, 'redo')
    }
  }
  const handleKeydown = createUndoKeydownHandler(enabled, root, isEditing, undo, redo)
  registerScopedKeydownListener(enabled, handleKeydown)

  return { stack, canUndo, canRedo, record, commit, undo, redo, handleKeydown }
}
