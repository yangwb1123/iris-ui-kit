/**
 * localStorage persistence for the todo list.
 * Falls back to in-memory when storage is unavailable (SSR, private browsing, etc.).
 */

import type { Todo } from '../types/todo'

const STORAGE_KEY = 'iris-todo-app-todos'

/** Read the persisted todo array. Returns `null` on read failure or empty state. */
function readStorage(): Todo[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as Todo[]
  } catch {
    return null
  }
}

/** Write the todo array to storage. Silently fails when storage is unavailable. */
function writeStorage(todos: Todo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  } catch {
    // Storage full or unavailable — degradation is acceptable for a demo app.
  }
}

/**
 * Create a storage adapter for the todo list.
 *
 * Returns `{ load, save }` where `load` reads from localStorage (returning
 * `null` when absent or corrupt) and `save` writes back. Consumers can hydrate
 * React state from `load()` and persist on every mutation via `save()`.
 */
export function createTodoStorage() {
  return {
    load: readStorage,
    save: writeStorage,
  }
}
