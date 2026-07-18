import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTodoStorage } from './storage'
import type { Todo } from '../types/todo'

const SAMPLE: Todo[] = [{ id: 'todo-1', text: 'buy milk', completed: false, createdAt: 1 }]

/**
 * Minimal in-memory `Storage` stand-in.
 *
 * Not using jsdom's `window.localStorage` here: the Node version this repo
 * runs on ships an experimental built-in global `localStorage` that vitest's
 * jsdom environment does not override (see vitest's `populateGlobal`, which
 * only copies jsdom window keys onto `global` when they're either absent or
 * on its explicit allowlist — `localStorage` is on neither), so the real
 * jsdom storage never becomes reachable as the global. A tiny stub sidesteps
 * that entirely and is all `createTodoStorage` actually needs.
 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size
    },
  }
}

describe('createTodoStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('load() returns null when nothing has been saved', () => {
    const storage = createTodoStorage()
    expect(storage.load()).toBeNull()
  })

  it('save() then load() round-trips the todo array', () => {
    const storage = createTodoStorage()
    storage.save(SAMPLE)
    expect(storage.load()).toEqual(SAMPLE)
  })

  it('load() returns null for corrupt JSON', () => {
    localStorage.setItem('iris-todo-app-todos', 'not json{')
    const storage = createTodoStorage()
    expect(storage.load()).toBeNull()
  })

  it('load() returns null when the stored value is not an array', () => {
    localStorage.setItem('iris-todo-app-todos', JSON.stringify({ not: 'an array' }))
    const storage = createTodoStorage()
    expect(storage.load()).toBeNull()
  })

  it('save() silently swallows a full/unavailable storage', () => {
    vi.stubGlobal('localStorage', {
      ...createMemoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    const storage = createTodoStorage()
    expect(() => storage.save(SAMPLE)).not.toThrow()
  })
})
