/**
 * useTodos — the single stateful hook for the Todo App.
 *
 * Owns the todo array in React state, hydrates from localStorage on mount,
 * persists on every mutation, and exposes a stable-identity CRUD API so child
 * components never manage todos themselves.
 *
 * Design follows Iris UI's "A/B/C" principle:
 * - **A (core logic)**: The CRUD operations live here as plain functions.
 * - **B (persistence)**: Storage adapter is injected, not hard-coded.
 * - **C (pure utils)**: `filterTodos`/`activeCount` are stateless pure fns.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Todo, TodoFilter } from '../types/todo'
import { createTodoStorage } from '../utils/storage'
import { filterTodos, activeCount } from '../utils/filters'

/** Simple counter-based id generator (safe for single-user demo). */
let nextId = 1
function generateId(): string {
  return `todo-${Date.now()}-${nextId++}`
}

export interface UseTodosReturn {
  /** The full, unfiltered todo list. */
  todos: Todo[]
  /** The current filter. */
  filter: TodoFilter
  /** Set the current filter. */
  setFilter: (filter: TodoFilter) => void
  /** The filtered view of todos. */
  filteredTodos: Todo[]
  /** Number of active (incomplete) items. */
  activeCount: number
  /** Add a new todo from text. No-op on empty/whitespace-only input. */
  addTodo: (text: string) => void
  /** Toggle a todo's completion state by id. */
  toggleTodo: (id: string) => void
  /** Update a todo's text by id. No-op on empty/whitespace-only input. */
  updateTodo: (id: string, text: string) => void
  /** Remove a todo by id. */
  deleteTodo: (id: string) => void
  /** Remove all completed todos. */
  clearCompleted: () => void
}

/**
 * Root todo-state hook. Call once in the app shell and pass callbacks down.
 *
 * @example
 *   const { todos, filter, filteredTodos, addTodo, toggleTodo, ... } = useTodos()
 */
export function useTodos(): UseTodosReturn {
  const storage = useRef(createTodoStorage()).current
  const [todos, setTodos] = useState<Todo[]>(() => {
    const stored = storage.load()
    return stored ?? []
  })
  const [filter, setFilter] = useState<TodoFilter>('all')

  // Persist whenever todos change.
  const isFirstRender = useRef(true)
  useEffect(() => {
    // Skip persisting the initial hydration — storage already has that value.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    storage.save(todos)
  }, [todos, storage])

  const addTodo = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos((prev) => [
      {
        id: generateId(),
        text: trimmed,
        completed: false,
        createdAt: Date.now(),
      },
      ...prev,
    ])
  }, [])

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }, [])

  const updateTodo = useCallback((id: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text: trimmed } : t)))
  }, [])

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setTodos((prev) => prev.filter((t) => !t.completed))
  }, [])

  const filteredTodos = filterTodos(todos, filter)
  const activeItemCount = activeCount(todos)

  return {
    todos,
    filter,
    setFilter,
    filteredTodos,
    activeCount: activeItemCount,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    clearCompleted,
  }
}
