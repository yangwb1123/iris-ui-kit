import * as React from 'react'
import { createUndoStack, type UndoStack } from '@iris-ui-kit/core'

/**
 * Edit-undo composition interface for tables (vxe-grid undoRedoHistory
 * parity). Composed over the core `createUndoStack`; the parent owns the
 * data array (controlled), this hook records snapshots and replays them
 * through `onDataChange`.
 *
 * ```tsx
 * const tableUndo = useTableUndo(rows, setRows)
 * // after a cell edit commit:
 * tableUndo.pushSnapshot()
 * // keydown Mod+z / Mod+Shift+z:
 * tableUndo.undo() / tableUndo.redo()
 * ```
 */
export interface TableUndo<T> {
  /** Record the current data as a new snapshot (call after every commit). */
  pushSnapshot(): void
  /** Replay the previous snapshot through `onDataChange`. Returns it. */
  undo(): T[] | undefined
  /** Replay the next snapshot through `onDataChange`. Returns it. */
  redo(): T[] | undefined
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
  /** The underlying stack (for `depth`/`index` reads). */
  stack: UndoStack<T[]>
}

export function useTableUndo<T>(
  data: readonly T[],
  onDataChange: (next: T[]) => void,
): TableUndo<T> {
  const stackRef = React.useRef<UndoStack<T[]> | null>(null)
  if (stackRef.current === null) {
    stackRef.current = createUndoStack<T[]>({ maxSize: 100 })
  }
  const stack = stackRef.current
  const dataRef = React.useRef(data)
  dataRef.current = data as T[]
  const onChangeRef = React.useRef(onDataChange)
  onChangeRef.current = onDataChange
  const [version, setVersion] = React.useState(0)

  return React.useMemo(
    () => ({
      pushSnapshot() {
        stack.push(dataRef.current)
      },
      undo() {
        const snapshot = stack.undo()
        if (snapshot !== undefined) {
          onChangeRef.current(snapshot)
          setVersion((v) => v + 1)
        }
        return snapshot
      },
      redo() {
        const snapshot = stack.redo()
        if (snapshot !== undefined) {
          onChangeRef.current(snapshot)
          setVersion((v) => v + 1)
        }
        return snapshot
      },
      canUndo: () => stack.canUndo(),
      canRedo: () => stack.canRedo(),
      clear: () => stack.clear(),
      stack,
    }),
    [version, stack],
  )
}
