import {
  createUndoStack,
  matchTableKey,
  normalizeKeymap,
  type AuditLogType,
  type UndoStack,
} from '@iris-ui-kit/core'

type Row = Record<string, unknown>
type RowKey = string | number

export interface TableUndoSelectionContext {
  current: () => RowKey[]
  enabled: () => boolean
  keyOf: (row: Row, index: number) => RowKey
  rebase: () => void
  set: (keys: RowKey[]) => void
}

export interface TableUndoContext {
  enabled: () => boolean
  initialRows: () => Row[]
  sourceRows: () => Row[]
  setRows: (rows: Row[]) => void
  onDataChange?: (rows: Row[]) => void
  root: () => HTMLElement | null
  isEditing: () => boolean
  selection: TableUndoSelectionContext
}

export interface TableUndoController {
  readonly stack: UndoStack<Row[]>
  readonly canUndo: () => boolean
  readonly canRedo: () => boolean
  /** Observe a post-change rows transaction and add it to history when enabled. */
  readonly record: (rows: Row[]) => void
  /** Apply a snapshot through the table's guarded rows transaction. */
  readonly commit: (rows: Row[], type?: AuditLogType) => void
  readonly undo: () => void
  readonly redo: () => void
  /** Keep an untouched stack aligned with parent/proxy source changes. */
  readonly syncSource: (rows: Row[]) => void
  /** Rebaseline when the opt-in prop transitions from off to on. */
  readonly syncEnabled: (enabled: boolean) => void
  /** True while the window shortcut listener should be installed. */
  readonly shortcutsEnabled: () => boolean
  readonly handleKeydown: (event: KeyboardEvent) => void
}

function sameRowList(a: Row[], b: Row[]): boolean {
  if (a === b) return true
  return a.length === b.length && a.every((row, index) => row === b[index])
}

/**
 * Svelte's framework bridge for the framework-free row-list undo stack.
 *
 * The rows feature owns every mutation boundary; IrisTable calls `record`
 * from `onRowsChange`, while replay uses `commit` with a restoring guard so a
 * replay never manufactures a new history entry.
 */
export function createTableUndoController(ctx: TableUndoContext): TableUndoController {
  let liveRows = [...(ctx.initialRows() ?? [])]
  const stack = createUndoStack<Row[]>({
    maxHistory: 100,
    initial: [...liveRows],
    equals: sameRowList,
  })
  let restoring = false
  let lastSource = ctx.sourceRows()
  let wasEnabled = ctx.enabled()
  // A rune-backed revision makes toolbar accessors reactive after push/undo/
  // redo/clear. `canUndo()` reads it explicitly below.
  let revision = $state(0)

  const bump = (): void => {
    revision += 1
  }

  const record = (rows: Row[]): void => {
    liveRows = rows
    if (!ctx.enabled() || restoring) return
    stack.push([...rows])
    bump()
  }

  const commit = (rows: Row[], type: AuditLogType = 'edit'): void => {
    restoring = true
    try {
      // `setRows` goes through Grid Rows, whose transaction callback updates
      // `liveRows` while this restoring guard suppresses a second push.
      ctx.setRows(rows)
      ctx.onDataChange?.(rows)
    } finally {
      restoring = false
    }
    // Keep the audit-type argument part of the bridge contract for parity with
    // the other adapters. Svelte currently has no audit-log surface, but the
    // type is intentionally accepted so future audit plugins can consume it.
    void type
  }

  const canReplay = (): boolean => !ctx.isEditing()
  const canUndo = (): boolean => {
    void revision
    return ctx.enabled() && canReplay() && stack.canUndo()
  }
  const canRedo = (): boolean => {
    void revision
    return ctx.enabled() && canReplay() && stack.canRedo()
  }

  const replay = (rows: Row[] | undefined, type: AuditLogType): void => {
    if (rows === undefined || !canReplay()) return
    const selected = ctx.selection.current()
    if (ctx.selection.enabled() && selected.length > 0) {
      const present = new Set(rows.map((row, index) => ctx.selection.keyOf(row, index)))
      const kept = selected.filter((key) => present.has(key))
      if (kept.length !== selected.length) {
        ctx.selection.rebase()
        ctx.selection.set(kept)
      }
    }
    commit(rows, type)
  }

  const undo = (): void => {
    if (!ctx.enabled() || !canReplay()) return
    const rows = stack.undo()
    if (rows !== undefined) {
      bump()
      replay(rows, 'undo')
    }
  }

  const redo = (): void => {
    if (!ctx.enabled() || !canReplay()) return
    const rows = stack.redo()
    if (rows !== undefined) {
      bump()
      replay(rows, 'redo')
    }
  }

  const syncSource = (rows: Row[]): void => {
    if (rows === lastSource) return
    lastSource = rows
    liveRows = rows
    // External data changes are a baseline only while untouched. Once a user
    // mutation exists, preserving the history lets undo return to its prior
    // post-change snapshot just like the React/Vue/Solid bridges.
    if (!stack.canUndo() && !stack.canRedo()) {
      stack.clear()
      stack.push([...rows])
      bump()
    }
  }

  const syncEnabled = (enabled: boolean): void => {
    if (enabled && !wasEnabled) {
      stack.clear()
      // `initialRows` is the live adapter list, not merely the immutable prop;
      // enabling after an opt-out edit must not fabricate an undo step.
      stack.push([...(ctx.initialRows() ?? liveRows)])
      liveRows = [...(ctx.initialRows() ?? liveRows)]
      bump()
    }
    wasEnabled = enabled
  }

  const isInsideRoot = (target: EventTarget | null): boolean => {
    if (!target || typeof target !== 'object') return false
    const root = ctx.root()
    if (root === null || !('nodeType' in target)) return false
    return root.contains(target as Node)
  }

  const isTextControl = (target: EventTarget | null): boolean => {
    if (!target || typeof target !== 'object') return false
    const element = target as HTMLElement
    return (
      element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.tagName === 'SELECT' ||
      element.dataset?.irisTableEditor !== undefined ||
      element.closest?.('[data-iris-table-editor]') !== null
    )
  }

  const bindings = normalizeKeymap()
  const handleKeydown = (event: KeyboardEvent): void => {
    if (!ctx.enabled() || event.defaultPrevented) return
    if (!isInsideRoot(event.target)) return
    if (isTextControl(event.target) || ctx.isEditing()) return
    if (matchTableKey(event, bindings.undo)) {
      event.preventDefault()
      undo()
    } else if (matchTableKey(event, bindings.redo)) {
      event.preventDefault()
      redo()
    }
  }

  return {
    stack,
    canUndo,
    canRedo,
    record,
    commit,
    undo,
    redo,
    syncSource,
    syncEnabled,
    shortcutsEnabled: () => {
      void revision
      return ctx.enabled()
    },
    handleKeydown,
  }
}
