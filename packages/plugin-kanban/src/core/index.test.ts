import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import { createKanban, kanbanPlugin, kanbanTokens, type KanbanConfig } from './index'

const baseConfig = (): KanbanConfig => ({
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: 'c1', title: 'Card 1', tags: ['bug'] },
        { id: 'c2', title: 'Card 2' },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      cards: [],
      limit: 2,
    },
    {
      id: 'done',
      title: 'Done',
      cards: [],
    },
  ],
})

describe('createKanban core', () => {
  it('returns initial state matching the config columns', () => {
    const store = createKanban(baseConfig())
    const { columns } = store.getState()
    expect(columns).toHaveLength(3)
    expect(columns[0]!.id).toBe('todo')
    expect(columns[0]!.cards).toHaveLength(2)
    expect(columns[1]!.cards).toHaveLength(0)
  })

  it('moveCard moves a card to another column and notifies subscribers', () => {
    const store = createKanban(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.moveCard('c1', 'in-progress')

    const { columns } = store.getState()
    expect(columns[0]!.cards.map((c) => c.id)).not.toContain('c1')
    expect(columns[1]!.cards.map((c) => c.id)).toContain('c1')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('moveCard fires onMove callback with correct args', () => {
    const onMove = vi.fn()
    const store = createKanban({ ...baseConfig(), onMove })
    store.moveCard('c2', 'done')
    expect(onMove).toHaveBeenCalledWith('c2', 'todo', 'done')
  })

  it('moveCard is a no-op when card does not exist', () => {
    const store = createKanban(baseConfig())
    const before = store.getState()
    store.moveCard('nonexistent', 'done')
    expect(store.getState()).toBe(before) // same reference → no setState
  })

  it('moveCard is a no-op when source == target column', () => {
    const store = createKanban(baseConfig())
    const before = store.getState()
    store.moveCard('c1', 'todo')
    expect(store.getState()).toBe(before)
  })

  it('moveCard is a no-op when target column is at its WIP limit', () => {
    const cfg = baseConfig()
    cfg.columns[1]!.cards = [
      { id: 'x1', title: 'X1' },
      { id: 'x2', title: 'X2' },
    ]
    const store = createKanban(cfg)
    store.moveCard('c1', 'in-progress')
    const { columns } = store.getState()
    // c1 must still be in todo
    expect(columns[0]!.cards.map((c) => c.id)).toContain('c1')
    // in-progress still has 2 cards (unchanged)
    expect(columns[1]!.cards).toHaveLength(2)
  })

  it('addCard appends a card to a column and notifies subscribers', () => {
    const store = createKanban(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.addCard('done', { id: 'c3', title: 'Card 3', description: 'New' })

    const { columns } = store.getState()
    expect(columns[2]!.cards).toHaveLength(1)
    expect(columns[2]!.cards[0]!.id).toBe('c3')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('addCard is a no-op when the column is at its WIP limit', () => {
    const cfg = baseConfig()
    cfg.columns[1]!.cards = [
      { id: 'x1', title: 'X1' },
      { id: 'x2', title: 'X2' },
    ]
    const store = createKanban(cfg)
    const before = store.getState()
    store.addCard('in-progress', { id: 'x3', title: 'X3' })
    expect(store.getState()).toBe(before)
  })

  it('addCard is a no-op when a card with the same id already exists', () => {
    const store = createKanban(baseConfig())
    const before = store.getState()
    store.addCard('todo', { id: 'c1', title: 'Duplicate' })
    expect(store.getState()).toBe(before)
  })

  it('removeCard removes a card from its column and notifies subscribers', () => {
    const store = createKanban(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.removeCard('c1')

    const { columns } = store.getState()
    expect(columns[0]!.cards.map((c) => c.id)).not.toContain('c1')
    expect(columns[0]!.cards).toHaveLength(1)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('removeCard is a no-op for a non-existent card id', () => {
    const store = createKanban(baseConfig())
    const before = store.getState()
    store.removeCard('ghost')
    expect(store.getState()).toBe(before)
  })

  it('subscribe returns an unsubscribe function that stops notifications', () => {
    const store = createKanban(baseConfig())
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    store.moveCard('c1', 'done')
    expect(listener).not.toHaveBeenCalled()
  })

  it('mutations do not mutate the original config object', () => {
    const cfg = baseConfig()
    const store = createKanban(cfg)
    store.moveCard('c1', 'done')
    // Original config still has c1 in todo
    expect(cfg.columns[0]!.cards.map((c) => c.id)).toContain('c1')
  })
})

describe('kanbanPlugin', () => {
  it('registers kanban tokens', () => {
    const { tokens } = runPlugins([kanbanPlugin])
    expect(tokens['--iris-kanban-gap']).toBe(kanbanTokens['--iris-kanban-gap'])
    expect(tokens['--iris-kanban-col-width']).toBe(kanbanTokens['--iris-kanban-col-width'])
    expect(tokens['--iris-kanban-card-bg']).toBe(kanbanTokens['--iris-kanban-card-bg'])
  })
})
