import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@solidjs/testing-library'
import { IrisKanban } from './index'
import type { KanbanConfig } from '../core'

const config = (): KanbanConfig => ({
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
      id: 'done',
      title: 'Done',
      cards: [],
    },
  ],
})

describe('IrisKanban (solid)', () => {
  it('renders both columns', () => {
    const { container } = render(() => <IrisKanban config={config()} />)
    expect(container.querySelector('[data-iris-kanban-column="todo"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-kanban-column="done"]')).toBeTruthy()
  })

  it('renders cards inside their column', () => {
    const { container } = render(() => <IrisKanban config={config()} />)
    const todoCol = container.querySelector('[data-iris-kanban-column="todo"]')!
    expect(todoCol.querySelector('[data-iris-kanban-card="c1"]')).toBeTruthy()
    expect(todoCol.querySelector('[data-iris-kanban-card="c2"]')).toBeTruthy()
  })

  it('renders card title and tags', () => {
    const { container } = render(() => <IrisKanban config={config()} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    expect(card.querySelector('[data-iris-kanban-card-title]')?.textContent).toBe('Card 1')
    expect(card.querySelector('[data-iris-kanban-tag]')?.textContent).toBe('bug')
  })

  it('drag-and-drop calls moveCard on drop', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const { container } = render(() => <IrisKanban config={cfg} />)

    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    const doneCol = container.querySelector('[data-iris-kanban-column="done"]')!

    fireEvent.dragStart(card)
    fireEvent.dragOver(doneCol)
    fireEvent.drop(doneCol)

    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
  })
})
