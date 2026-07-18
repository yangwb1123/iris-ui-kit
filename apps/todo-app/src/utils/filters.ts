/**
 * Pure filter logic for the todo list.
 * Kept in core-style utils so they are trivially testable without React.
 */

import type { Todo, TodoFilter } from '../types/todo'

/** Filter a todo array by the given filter mode. */
export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  switch (filter) {
    case 'active':
      return todos.filter((t) => !t.completed)
    case 'completed':
      return todos.filter((t) => t.completed)
    case 'all':
    default:
      return todos
  }
}

/** Count of active (incomplete) todos. */
export function activeCount(todos: Todo[]): number {
  return todos.filter((t) => !t.completed).length
}

/** Whether any todo is completed (used to show/hide "clear completed"). */
export function hasCompleted(todos: Todo[]): boolean {
  return todos.some((t) => t.completed)
}
