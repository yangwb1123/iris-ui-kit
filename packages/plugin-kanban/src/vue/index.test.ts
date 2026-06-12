import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisKanban } from './index'
import type { KanbanConfig } from '../core'

// jsdom drops clientX/clientY/pointerType from synthetic PointerEvents, so we
// dispatch a MouseEvent (which DOES carry clientX/Y in jsdom) typed as a pointer
// event with pointerType defined — the same shape the component reads.
// @vue/test-utils has no fireEvent, so dispatch on the DOM element directly.
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
  el.dispatchEvent(ev)
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

describe('IrisKanban (vue)', () => {
  it('renders both columns', () => {
    const wrapper = mount(IrisKanban, { props: { config: config() } })
    expect(wrapper.find('[data-iris-kanban-column="todo"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-kanban-column="done"]').exists()).toBe(true)
  })

  it('renders cards inside their column', () => {
    const wrapper = mount(IrisKanban, { props: { config: config() } })
    const todoCol = wrapper.find('[data-iris-kanban-column="todo"]')
    expect(todoCol.find('[data-iris-kanban-card="c1"]').exists()).toBe(true)
    expect(todoCol.find('[data-iris-kanban-card="c2"]').exists()).toBe(true)
  })

  it('renders card title, description, and tags', () => {
    const wrapper = mount(IrisKanban, { props: { config: config() } })
    const card = wrapper.find('[data-iris-kanban-card="c1"]')
    expect(card.find('[data-iris-kanban-card-title]').text()).toBe('Card 1')
    expect(card.find('[data-iris-kanban-card-desc]').text()).toBe('Fix bug')
    expect(card.find('[data-iris-kanban-tag]').text()).toBe('bug')
  })

  it('shows WIP badge when column is at limit', async () => {
    const cfg = config()
    cfg.columns[0]!.limit = 2
    const wrapper = mount(IrisKanban, { props: { config: cfg } })
    expect(
      wrapper.find('[data-iris-kanban-column="todo"] [data-iris-kanban-wip-badge]').exists(),
    ).toBe(true)
  })

  it('triggers onMove via drop', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const wrapper = mount(IrisKanban, { props: { config: cfg } })

    const card = wrapper.find('[data-iris-kanban-card="c1"]')
    const doneCol = wrapper.find('[data-iris-kanban-column="done"]')

    await card.trigger('dragstart')
    await doneCol.trigger('dragover')
    await doneCol.trigger('drop')

    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
  })

  it('touch: pointer-drag a card onto another column calls moveCard', () => {
    const onMove = vi.fn()
    const wrapper = mount(IrisKanban, { props: { config: { ...config(), onMove } } })
    const root = wrapper.element as HTMLElement
    const card = root.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(root.querySelector('[data-iris-kanban-column="todo"]')!, 0)
    stubRect(root.querySelector('[data-iris-kanban-column="done"]')!, 200)

    // touch pointer: down on the card, move over the 'done' column, release.
    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50 })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50 })

    expect(onMove).toHaveBeenCalledWith('c1', 'todo', 'done')
  })

  it('touch: mouse pointers do NOT trigger the pointer path (native DnD owns mouse)', () => {
    const onMove = vi.fn()
    const wrapper = mount(IrisKanban, { props: { config: { ...config(), onMove } } })
    const root = wrapper.element as HTMLElement
    const card = root.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(root.querySelector('[data-iris-kanban-column="todo"]')!, 0)
    stubRect(root.querySelector('[data-iris-kanban-column="done"]')!, 200)

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
    const wrapper = mount(IrisKanban, { props: { config: cfg } })
    const root = wrapper.element as HTMLElement
    const card = root.querySelector('[data-iris-kanban-card="c1"]')!
    stubRect(root.querySelector('[data-iris-kanban-column="src"]')!, 0)
    stubRect(root.querySelector('[data-iris-kanban-column="full"]')!, 200)

    pointer(card, 'pointerdown', { clientX: 50, clientY: 50 })
    pointer(card, 'pointermove', { clientX: 250, clientY: 50 })
    pointer(card, 'pointerup', { clientX: 250, clientY: 50 })

    expect(onMove).not.toHaveBeenCalled()
  })
})
