/**
 * Todo domain types for the Iris UI Todo App.
 * All business logic operates on these primitives.
 */

/** Filter mode for the todo list view. */
export type TodoFilter = 'all' | 'active' | 'completed'

/** A single todo item. */
export interface Todo {
  /** Unique identifier (nanoid-style). */
  id: string
  /** User-visible task description. */
  text: string
  /** Completion state. */
  completed: boolean
  /** Unix timestamp (ms) when the todo was created. */
  createdAt: number
}
