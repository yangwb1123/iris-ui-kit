/**
 * JSON snapshot history used by createFormStore. The controller is agnostic
 * about the store shape: callers provide value readers/writers and a token
 * invalidator so undo/redo cannot resurrect stale validation results.
 */
export interface FormHistory {
  save(): void
  clear(): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

export function createFormHistory<V>(options: {
  max: number
  read: () => V
  write: (values: V) => void
  invalidate: () => void
}): FormHistory {
  const history: string[] = []
  let index = -1

  const save = (): void => {
    if (options.max <= 0) return
    let snapshot: string
    try {
      snapshot = JSON.stringify(options.read())
    } catch {
      return
    }
    history.splice(index + 1)
    if (history.at(-1) === snapshot) return
    history.push(snapshot)
    if (history.length > options.max) history.shift()
    index = history.length - 1
  }

  return {
    save,
    clear: () => {
      history.length = 0
      index = -1
    },
    undo: () => {
      if (index <= 0) return
      index -= 1
      options.invalidate()
      options.write(JSON.parse(history[index]!))
    },
    redo: () => {
      if (index >= history.length - 1) return
      index += 1
      options.invalidate()
      options.write(JSON.parse(history[index]!))
    },
    canUndo: () => index > 0,
    canRedo: () => index < history.length - 1,
  }
}
