import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisDashboard } from './index'
import type { DashboardConfig } from '../core'

const config = (): DashboardConfig => ({
  widgets: [
    { id: 'w1', title: 'Widget 1', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { id: 'w2', title: 'Widget 2', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
  ],
  columns: 3,
})

describe('IrisDashboard (vue)', () => {
  it('renders widget elements', () => {
    const wrapper = mount(IrisDashboard, { props: { config: config() } })
    expect(wrapper.find('[data-iris-dashboard-widget="w1"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-dashboard-widget="w2"]').exists()).toBe(true)
  })

  it('renders widget titles', () => {
    const wrapper = mount(IrisDashboard, { props: { config: config() } })
    expect(wrapper.find('[data-iris-dashboard-widget-title="w1"]').text()).toBe('Widget 1')
    expect(wrapper.find('[data-iris-dashboard-widget-title="w2"]').text()).toBe('Widget 2')
  })

  it('renders drag handles', () => {
    const wrapper = mount(IrisDashboard, { props: { config: config() } })
    const handles = wrapper.findAll('[data-iris-dashboard-drag-handle]')
    expect(handles.length).toBe(2)
  })

  it('renders content areas', () => {
    const wrapper = mount(IrisDashboard, { props: { config: config() } })
    expect(wrapper.find('[data-iris-dashboard-widget-content="w1"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-dashboard-widget-content="w2"]').exists()).toBe(true)
  })

  it('renders drop cells for the grid', () => {
    const wrapper = mount(IrisDashboard, { props: { config: config() } })
    const cells = wrapper.findAll('[data-iris-dashboard-cell]')
    expect(cells.length).toBeGreaterThanOrEqual(6)
  })

  it('triggers onMove via drag-and-drop', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const wrapper = mount(IrisDashboard, { props: { config: cfg } })

    const header = wrapper.find('[data-iris-dashboard-widget-header="w1"]')
    const targetCell = wrapper.find('[data-iris-dashboard-cell="2-2"]')

    await header.trigger('dragstart')
    await targetCell.trigger('dragover')
    await targetCell.trigger('drop')

    expect(onMove).toHaveBeenCalledWith('w1', 2, 2)
  })
})
