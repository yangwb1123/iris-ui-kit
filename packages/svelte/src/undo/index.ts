export { useUndoStack, type UndoStackReactiveState } from './useUndoStack.svelte'

// Re-export the core engine so Svelte consumers don't need a separate import.
export { createUndoStack, type UndoStack, type UndoStackOptions } from '@iris-ui-kit/core/undo'
