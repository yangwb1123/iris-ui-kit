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
  const max =
    typeof options.max === 'number' && !Number.isNaN(options.max)
      ? options.max === Infinity
        ? Infinity
        : Math.max(0, Math.floor(options.max))
      : 0

  const save = (): void => {
    if (max <= 0) return
    let snapshot: string | undefined
    try {
      const encoded = JSON.stringify(options.read())
      if (typeof encoded !== 'string') return
      snapshot = encoded
    } catch {
      return
    }
    history.splice(index + 1)
    if (history.at(-1) === snapshot) return
    history.push(snapshot)
    if (history.length > max) history.shift()
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
      const previous = index
      const target = index - 1
      let values: V
      try {
        values = JSON.parse(history[target]!) as V
      } catch {
        return
      }
      index = target
      try {
        options.invalidate()
        // A re-entrant save/clear supersedes this navigation.
        if (index !== target) return
        options.write(values)
      } catch (error) {
        if (index === target) index = previous
        throw error
      }
    },
    redo: () => {
      if (index >= history.length - 1) return
      const previous = index
      const target = index + 1
      let values: V
      try {
        values = JSON.parse(history[target]!) as V
      } catch {
        return
      }
      index = target
      try {
        options.invalidate()
        // A re-entrant save/clear supersedes this navigation.
        if (index !== target) return
        options.write(values)
      } catch (error) {
        if (index === target) index = previous
        throw error
      }
    },
    canUndo: () => index > 0,
    canRedo: () => index < history.length - 1,
  }
}
