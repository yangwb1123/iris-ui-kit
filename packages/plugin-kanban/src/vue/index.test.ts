import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisKanban } from './index'
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
})
