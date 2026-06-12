import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { IrisKanban } from './index'
import type { KanbanConfig } from '../core'

afterEach(cleanup)

// jsdom drops clientX/clientY/pointerType from synthetic PointerEvents, so we
// dispatch a MouseEvent (which DOES carry clientX/Y in jsdom) typed as a pointer
// event with pointerType defined — the same shape the component reads.
function pointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  opts: { clientX: number; clientY: number; pointerType?: string; pointerId?: number },
) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX,
    clientY: opts.clientY,
  })
  Object.defineProperty(ev, 'pointerType', { value: opts.pointerType ?? 'touch' })
  Object.defineProperty(ev, 'pointerId', { value: opts.pointerId ?? 1 })
  fireEvent(el, ev)
}

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

describe('IrisKanban (react)', () => {
  it('renders both columns with their titles', () => {
    const { getByText } = render(<IrisKanban config={config()} />)
    expect(getByText('To Do')).toBeTruthy()
    expect(getByText('Done')).toBeTruthy()
  })

  it('renders cards inside their column', () => {
    const { container } = render(<IrisKanban config={config()} />)
    const todoCol = container.querySelector('[data-iris-kanban-column="todo"]')!
    expect(todoCol).toBeTruthy()
    expect(todoCol.querySelector('[data-iris-kanban-card="c1"]')).toBeTruthy()
    expect(todoCol.querySelector('[data-iris-kanban-card="c2"]')).toBeTruthy()
  })

  it('renders card title, description, and tags', () => {
    const { container } = render(<IrisKanban config={config()} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    expect(card.querySelector('[data-iris-kanban-card-title]')?.textContent).toBe('Card 1')
    expect(card.querySelector('[data-iris-kanban-card-desc]')?.textContent).toBe('Fix bug')
    expect(card.querySelector('[data-iris-kanban-tag]')?.textContent).toBe('bug')
  })

  it('shows card count in column header', () => {
    const { container } = render(<IrisKanban config={config()} />)
    const todoHeader = container.querySelector(
      '[data-iris-kanban-column="todo"] [data-iris-kanban-count]',
    )!
    expect(todoHeader.textContent).toBe('2')
  })

  it('shows WIP limit in count when limit is set', () => {
    const cfg = config()
    cfg.columns[0]!.limit = 3
    const { container } = render(<IrisKanban config={cfg} />)
    const count = container.querySelector(
      '[data-iris-kanban-column="todo"] [data-iris-kanban-count]',
    )!
    expect(count.textContent).toBe('2/3')
  })

  it('shows WIP badge when column is at limit', () => {
    const cfg = config()
    cfg.columns[0]!.limit = 2 // exactly at limit
    const { container } = render(<IrisKanban config={cfg} />)
    expect(
      container.querySelector('[data-iris-kanban-column="todo"] [data-iris-kanban-wip-badge]'),
    ).toBeTruthy()
  })

  it('drag-and-drop: dragStart + drop on another column calls moveCard', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const { container } = render(<IrisKanban config={cfg} />)

    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    const doneCol = container.querySelector('[data-iris-kanban-column="done"]')!

    // Simulate native HTML5 DnD sequence
    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: 'move' } })
    fireEvent.dragOver(doneCol, { dataTransfer: { dropEffect: 'move' } })
    fireEvent.drop(doneCol, { dataTransfer: {} })

    // onMove should have been called and card should appear in done column
    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-iris-kanban-column="done"] [data-iris-kanban-card="c1"]'),
      ).toBeTruthy()
    })
  })

  // Stub a column's layout rect so closestCenter has real geometry in jsdom
  // (which otherwise reports all-zero rects).
  const stubRect = (el: Element, left: number, width = 100) =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left,
      top: 0,
      width,
      height: 400,
      right: left + width,
      bottom: 400,
      x: left,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

  it('touch: pointer-drag a card onto another column calls moveCard', () => {
    const onMove = vi.fn()
    const { container } = render(<IrisKanban config={{ ...config(), onMove }} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(container.querySelector('[data-iris-kanban-column="todo"]')!, 0)
    stubRect(container.querySelector('[data-iris-kanban-column="done"]')!, 200)

    // touch pointer: down on the card, move over the 'done' column, release.
    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50 })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50 })

    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
    expect(
      container.querySelector('[data-iris-kanban-column="done"] [data-iris-kanban-card="c1"]'),
    ).toBeTruthy()
  })

  it('touch: a tap (no movement past threshold) does NOT move the card', () => {
    const onMove = vi.fn()
    const { container } = render(<IrisKanban config={{ ...config(), onMove }} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(container.querySelector('[data-iris-kanban-column="todo"]')!, 0)
    stubRect(container.querySelector('[data-iris-kanban-column="done"]')!, 200)

    // down then up at the same point (a tap) — and a sub-threshold jitter move.
    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 52, clientY: 51 })
    pointer(card, 'pointerup', { clientX: 52, clientY: 51 })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('touch: mouse pointers do NOT trigger the pointer path (native DnD owns mouse)', () => {
    const onMove = vi.fn()
    const { container } = render(<IrisKanban config={{ ...config(), onMove }} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(container.querySelector('[data-iris-kanban-column="todo"]')!, 0)
    stubRect(container.querySelector('[data-iris-kanban-column="done"]')!, 200)

    pointer(card, 'pointerdown', { clientX: 50, clientY: 50, pointerType: 'mouse' })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50, pointerType: 'mouse' })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50, pointerType: 'mouse' })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('touch: pointer-drop is blocked when the target column is at WIP limit', () => {
    const onMove = vi.fn()
    const cfg: KanbanConfig = {
      columns: [
        { id: 'src', title: 'Source', cards: [{ id: 'c1', title: 'Card 1' }] },
        { id: 'full', title: 'Full', cards: [{ id: 'x1', title: 'X1' }], limit: 1 },
      ],
      onMove,
    }
    const { container } = render(<IrisKanban config={cfg} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(container.querySelector('[data-iris-kanban-column="src"]')!, 0)
    stubRect(container.querySelector('[data-iris-kanban-column="full"]')!, 200)

    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50 })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50 })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('drag-and-drop: drop is blocked when target column is at WIP limit', () => {
    const onMove = vi.fn()
    const cfg: KanbanConfig = {
      columns: [
        { id: 'src', title: 'Source', cards: [{ id: 'c1', title: 'Card 1' }] },
        {
          id: 'full',
          title: 'Full',
          cards: [
            { id: 'x1', title: 'X1' },
            { id: 'x2', title: 'X2' },
          ],
          limit: 2,
        },
      ],
      onMove,
    }
    const { container } = render(<IrisKanban config={cfg} />)

    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    const fullCol = container.querySelector('[data-iris-kanban-column="full"]')!

    fireEvent.dragStart(card)
    fireEvent.dragOver(fullCol, { dataTransfer: { dropEffect: 'none' } })
    fireEvent.drop(fullCol)

    // move should not have occurred
    expect(onMove).not.toHaveBeenCalled()
    // c1 still in src
    expect(
      container.querySelector('[data-iris-kanban-column="src"] [data-iris-kanban-card="c1"]'),
    ).toBeTruthy()
  })
})
