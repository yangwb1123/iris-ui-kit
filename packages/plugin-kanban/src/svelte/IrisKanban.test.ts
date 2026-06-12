import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import IrisKanban from './IrisKanban.svelte'
import type { KanbanConfig } from '../core'

const config = (): KanbanConfig => ({
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: 'c1', title: 'Card 1', description: 'Fix bug', tags: ['bug'] },
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

describe('IrisKanban (svelte)', () => {
  it('renders both columns', () => {
    const { container } = render(IrisKanban, { props: { config: config() } })
    expect(container.querySelector('[data-iris-kanban-column="todo"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-kanban-column="done"]')).toBeTruthy()
  })

  it('renders cards inside their column', () => {
    const { container } = render(IrisKanban, { props: { config: config() } })
    const todoCol = container.querySelector('[data-iris-kanban-column="todo"]')!
    expect(todoCol.querySelector('[data-iris-kanban-card="c1"]')).toBeTruthy()
    expect(todoCol.querySelector('[data-iris-kanban-card="c2"]')).toBeTruthy()
  })

  it('renders card title, description, and tags', () => {
    const { container } = render(IrisKanban, { props: { config: config() } })
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    expect(card.querySelector('[data-iris-kanban-card-title]')?.textContent).toBe('Card 1')
    expect(card.querySelector('[data-iris-kanban-card-desc]')?.textContent).toBe('Fix bug')
    expect(card.querySelector('[data-iris-kanban-tag]')?.textContent).toBe('bug')
  })

  it('shows WIP badge when column is at limit', () => {
    const cfg = config()
    cfg.columns[0]!.limit = 2
    const { container } = render(IrisKanban, { props: { config: cfg } })
    expect(
      container.querySelector('[data-iris-kanban-column="todo"] [data-iris-kanban-wip-badge]'),
    ).toBeTruthy()
  })

  it('drag-and-drop calls moveCard on drop', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const { container } = render(IrisKanban, { props: { config: cfg } })

    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    const doneCol = container.querySelector('[data-iris-kanban-column="done"]')!

    await fireEvent.dragStart(card)
    await fireEvent.dragOver(doneCol)
    await fireEvent.drop(doneCol)

    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
  })
})
