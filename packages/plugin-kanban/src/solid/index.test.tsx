import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@solidjs/testing-library'
import { IrisKanban } from './index'
import type { KanbanConfig } from '../core'

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

  it('touch: pointer-drag a card onto another column calls moveCard', () => {
    const onMove = vi.fn()
    const { container } = render(() => <IrisKanban config={{ ...config(), onMove }} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(container.querySelector('[data-iris-kanban-column="todo"]')!, 0)
    stubRect(container.querySelector('[data-iris-kanban-column="done"]')!, 200)

    // touch pointer: down on the card, move over the 'done' column, release.
    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50 })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50 })

    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
  })

  it('touch: mouse pointers do NOT trigger the pointer path (native DnD owns mouse)', () => {
    const onMove = vi.fn()
    const { container } = render(() => <IrisKanban config={{ ...config(), onMove }} />)
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
    const { container } = render(() => <IrisKanban config={cfg} />)
    const card = container.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(container.querySelector('[data-iris-kanban-column="src"]')!, 0)
    stubRect(container.querySelector('[data-iris-kanban-column="full"]')!, 200)

    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50 })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50 })

    expect(onMove).not.toHaveBeenCalled()
  })
})
