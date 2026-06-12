import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import IrisDashboard from './IrisDashboard.svelte'
import type { DashboardConfig } from '../core'

const config = (): DashboardConfig => ({
  widgets: [
    { id: 'w1', title: 'Widget 1', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { id: 'w2', title: 'Widget 2', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
  ],
  columns: 3,
})

describe('IrisDashboard (svelte)', () => {
  it('renders widget elements', () => {
    const { container } = render(IrisDashboard, { props: { config: config() } })
    expect(container.querySelector('[data-iris-dashboard-widget="w1"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-dashboard-widget="w2"]')).toBeTruthy()
  })

  it('renders widget titles', () => {
    const { container } = render(IrisDashboard, { props: { config: config() } })
    expect(container.querySelector('[data-iris-dashboard-widget-title="w1"]')?.textContent).toBe(
      'Widget 1',
    )
  })

  it('renders drag handles', () => {
    const { container } = render(IrisDashboard, { props: { config: config() } })
    const handles = container.querySelectorAll('[data-iris-dashboard-drag-handle]')
    expect(handles.length).toBe(2)
  })

  it('renders drop cells', () => {
    const { container } = render(IrisDashboard, { props: { config: config() } })
    const cells = container.querySelectorAll('[data-iris-dashboard-cell]')
    expect(cells.length).toBeGreaterThanOrEqual(6)
  })

  it('drag-and-drop calls moveWidget on drop', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const { container } = render(IrisDashboard, { props: { config: cfg } })

    const header = container.querySelector('[data-iris-dashboard-widget-header="w1"]')!
    const targetCell = container.querySelector('[data-iris-dashboard-cell="2-2"]')!

    await fireEvent.dragStart(header)
    await fireEvent.dragOver(targetCell)
    await fireEvent.drop(targetCell)

    expect(onMove).toHaveBeenCalledWith('w1', 2, 2)
  })
})
