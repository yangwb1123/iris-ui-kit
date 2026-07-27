export { useUndoStack, type UndoStackReactiveState } from './useUndoStack'

// Re-export the core engine so Vue consumers don't need a separate import.
export { createUndoStack, type UndoStack, type UndoStackOptions } from '@iris-ui-kit/core/undo'
