import { computed, ref, watch, type ComputedRef } from 'vue'
import {
  createUndoStack,
  matchTableKey,
  normalizeKeymap,
  type AuditLogType,
  type UndoStack,
} from '@iris-ui-kit/core'
import { isInsideTableRoot, isTextControl, registerScopedKeydownListener } from './table-shortcut'

type TableRow = Record<string, unknown>

/** Inputs for the table-local undo bridge. The row-list engine remains in core. */
export interface TableUndoContext {
  enabled: () => boolean
  initialRows: () => TableRow[]
  sourceRows: () => TableRow[]
  setRows: (rows: TableRow[]) => void
  recordAudit: (rows: TableRow[], type: AuditLogType) => void
  onDataChange: (rows: TableRow[]) => void
  root: () => HTMLElement | null
  isEditing: () => boolean
  selection: TableUndoSelectionContext
}

/** Selection hooks used to prune keys that disappear during replay. */
export interface TableUndoSelectionContext {
  current: () => Array<string | number>
  enabled: () => boolean
  keyOf: (row: TableRow, index: number) => string | number
  rebase: () => void
  set: (keys: Array<string | number>) => void
}

/** Vue bridge for the framework-free row-list undo stack. */
export interface TableUndoController {
  stack: UndoStack<TableRow[]>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  record: (rows: TableRow[]) => void
  commit: (rows: TableRow[], type?: AuditLogType) => void
  undo: () => void
  redo: () => void
  handleKeydown: (event: KeyboardEvent) => void
}

/**
 * Synchronous mirror of the live row list. Vue batches ref/computed updates,
 * so a second commit inside ONE event (row-mode edit sessions) must build from
 * the list the first commit produced, not the stale computed value.
 */
export function createCommittedList(source: () => TableRow[]): {
  list: () => TableRow[]
  sync: (next: TableRow[]) => void
} {
  let current = source()
  return {
    list: () => {
      const latest = source()
      if (latest !== current) current = latest
      return current
    },
    sync: (next) => {
      current = next
    },
  }
}

/** Replace one row cell without aliasing the committed row list. */
export function replaceTableCell(
  rows: TableRow[],
  key: string | number,
  columnKey: string,
  value: unknown,
  rowKeyOf: (row: TableRow, index: number) => string | number,
): TableRow[] {
  const index = rows.findIndex((candidate, i) => rowKeyOf(candidate, i) === key)
  if (index < 0) return rows
  const next = rows.slice()
  next[index] = { ...next[index]!, [columnKey]: value }
  return next
}

function sameRowList(a: TableRow[], b: TableRow[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * External re-feeds (parent `data` / proxy refetch) re-baseline the stack ONLY
 * while it is untouched — vxe undoRedoHistory parity: proactive user history
 * survives incidental data churn, a pristine table follows the data.
 */
function rebaselineOnExternalChange(
  ctx: TableUndoContext,
  stack: UndoStack<TableRow[]>,
  bump: () => void,
): void {
  let lastExternalRows = ctx.sourceRows()
  watch(ctx.sourceRows, (next) => {
    if (next === lastExternalRows) return
    lastExternalRows = next
    if (ctx.enabled() && !stack.canUndo() && !stack.canRedo()) {
      stack.clear()
      stack.push([...(next ?? [])])
      bump()
    }
  })
}

/** Replay an undo/redo snapshot: prune vanished keys, commit without re-push. */
function replayStep(
  ctx: TableUndoContext,
  commit: (rows: TableRow[], type: AuditLogType) => void,
  setRestoring: (value: boolean) => void,
): (rows: TableRow[] | undefined, type: AuditLogType) => void {
  return (rows, type) => {
    if (rows === undefined) return
    const before = ctx.selection.current()
    if (ctx.selection.enabled() && before.length > 0) {
      const keys = new Set<string | number>()
      rows.forEach((row, index) => keys.add(ctx.selection.keyOf(row, index)))
      const vanished = before.filter((key) => !keys.has(key))
      if (vanished.length > 0) {
        ctx.selection.rebase()
        ctx.selection.set(before.filter((key) => !vanished.includes(key)))
      }
    }
    setRestoring(true)
    try {
      commit(rows, type)
    } finally {
      setRestoring(false)
    }
  }
}

/** Shared keydown gate for the undo/redo shortcuts (window-scoped). */
function undoKeydownBindings(
  ctx: TableUndoContext,
  onUndo: () => void,
  onRedo: () => void,
): (event: KeyboardEvent) => void {
  const bindings = normalizeKeymap()
  return (event) => {
    if (!ctx.enabled() || event.defaultPrevented) return
    if (!isInsideTableRoot(ctx.root, event.target)) return
    if (isTextControl(event.target) || ctx.isEditing()) return
    if (matchTableKey(event, bindings.undo)) {
      event.preventDefault()
      onUndo()
    } else if (matchTableKey(event, bindings.redo)) {
      event.preventDefault()
      onRedo()
    }
  }
}

interface TableUndoRuntime {
  stack: UndoStack<TableRow[]>
  bump: () => void
  readTick: () => void
  record: (rows: TableRow[]) => void
  commit: (rows: TableRow[], type?: AuditLogType) => void
  setRestoring: (value: boolean) => void
}

/** Build the mutable stack/write-back runtime kept behind the Vue bridge. */
function createTableUndoRuntime(ctx: TableUndoContext): TableUndoRuntime {
  const stack = createUndoStack<TableRow[]>({
    maxHistory: 100,
    initial: [...(ctx.initialRows() ?? [])],
    equals: sameRowList,
  })
  const tick = ref(0)
  let restoring = false
  const bump = (): void => {
    tick.value += 1
  }
  const record = (rows: TableRow[]): void => {
    if (!ctx.enabled() || restoring) return
    stack.push([...(rows ?? [])])
    bump()
  }
  const commit = (rows: TableRow[], type: AuditLogType = 'edit'): void => {
    record(rows)
    ctx.recordAudit(rows, type)
    ctx.setRows(rows)
    ctx.onDataChange(rows)
  }
  return {
    stack,
    bump,
    readTick: () => void tick.value,
    record,
    commit,
    setRestoring: (value) => (restoring = value),
  }
}

function createUndoRedoActions(
  stack: UndoStack<TableRow[]>,
  bump: () => void,
  replay: (rows: TableRow[] | undefined, type: AuditLogType) => void,
): { undo: () => void; redo: () => void } {
  const undo = (): void => {
    const rows = stack.undo()
    if (rows !== undefined) {
      bump()
      replay(rows, 'undo')
    }
  }
  const redo = (): void => {
    const rows = stack.redo()
    if (rows !== undefined) {
      bump()
      replay(rows, 'redo')
    }
  }
  return { undo, redo }
}

/** Create one instance-local controller with POST-change snapshot semantics. */
export function createTableUndoController(
  enabled: TableUndoContext['enabled'],
  initialRows: TableUndoContext['initialRows'],
  sourceRows: TableUndoContext['sourceRows'],
  setRows: TableUndoContext['setRows'],
  recordAudit: TableUndoContext['recordAudit'],
  onDataChange: TableUndoContext['onDataChange'],
  root: TableUndoContext['root'],
  isEditing: TableUndoContext['isEditing'],
  selection: TableUndoSelectionContext,
): TableUndoController {
  const ctx: TableUndoContext = {
    enabled,
    initialRows,
    sourceRows,
    setRows,
    recordAudit,
    onDataChange,
    root,
    isEditing,
    selection,
  }
  const runtime = createTableUndoRuntime(ctx)
  const { stack, bump, record, commit } = runtime
  const canUndo = computed(() => {
    runtime.readTick()
    return stack.canUndo()
  })
  const canRedo = computed(() => {
    runtime.readTick()
    return stack.canRedo()
  })
  rebaselineOnExternalChange(ctx, stack, bump)
  const replay = replayStep(ctx, commit, runtime.setRestoring)
  const { undo, redo } = createUndoRedoActions(stack, bump, replay)
  const handleKeydown = undoKeydownBindings(ctx, undo, redo)
  registerScopedKeydownListener(() => ctx.enabled(), handleKeydown)
  return { stack, canUndo, canRedo, record, commit, undo, redo, handleKeydown }
}
