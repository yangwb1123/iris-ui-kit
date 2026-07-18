import { describe, it, expect } from 'vitest'
import { filterTodos, activeCount, hasCompleted } from './filters'
import type { Todo } from '../types/todo'

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    text: 'sample',
    completed: false,
    createdAt: 0,
    ...overrides,
  }
}

describe('filterTodos', () => {
  const todos: Todo[] = [
    todo({ id: 'a', completed: false }),
    todo({ id: 'b', completed: true }),
    todo({ id: 'c', completed: false }),
  ]

  it('"all" returns every todo unchanged', () => {
    expect(filterTodos(todos, 'all')).toEqual(todos)
  })

  it('"active" returns only incomplete todos', () => {
    expect(filterTodos(todos, 'active').map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('"completed" returns only completed todos', () => {
    expect(filterTodos(todos, 'completed').map((t) => t.id)).toEqual(['b'])
  })

  it('handles an empty list', () => {
    expect(filterTodos([], 'active')).toEqual([])
  })
})

describe('activeCount', () => {
  it('counts only incomplete todos', () => {
    const todos = [
      todo({ completed: false }),
      todo({ completed: true }),
      todo({ completed: false }),
    ]
    expect(activeCount(todos)).toBe(2)
  })

  it('is zero for an empty list', () => {
    expect(activeCount([])).toBe(0)
  })
})

describe('hasCompleted', () => {
  it('is true when at least one todo is completed', () => {
    expect(hasCompleted([todo({ completed: false }), todo({ completed: true })])).toBe(true)
  })

  it('is false when no todo is completed', () => {
    expect(hasCompleted([todo({ completed: false })])).toBe(false)
  })

  it('is false for an empty list', () => {
    expect(hasCompleted([])).toBe(false)
  })
})
