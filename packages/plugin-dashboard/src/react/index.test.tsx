import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { IrisDashboard } from './index'
import type { DashboardConfig } from '../core'

afterEach(cleanup)

const config = (): DashboardConfig => ({
  widgets: [
    { id: 'w1', title: 'Widget 1', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { id: 'w2', title: 'Widget 2', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
  ],
  columns: 3,
})

describe('IrisDashboard (react)', () => {
  it('renders widgets with their titles', () => {
    const { getByText } = render(<IrisDashboard config={config()} />)
    expect(getByText('Widget 1')).toBeTruthy()
    expect(getByText('Widget 2')).toBeTruthy()
  })

  it('renders widget elements with correct data attributes', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    expect(container.querySelector('[data-iris-dashboard-widget="w1"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-dashboard-widget="w2"]')).toBeTruthy()
  })

  it('renders widget title in header', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    const title = container.querySelector('[data-iris-dashboard-widget-title="w1"]')!
    expect(title.textContent).toBe('Widget 1')
  })

  it('renders a drag handle in each widget header', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    const handles = container.querySelectorAll('[data-iris-dashboard-drag-handle]')
    expect(handles.length).toBe(2)
  })

  it('renders a content area in each widget', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    expect(container.querySelector('[data-iris-dashboard-widget-content="w1"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-dashboard-widget-content="w2"]')).toBeTruthy()
  })

  it('renders drop cells for the grid', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    // rows = ceil(2/3)+1 = 2; cols = 3 → 6 cells
    const cells = container.querySelectorAll('[data-iris-dashboard-cell]')
    expect(cells.length).toBeGreaterThanOrEqual(6)
  })

  it('drag-and-drop: dragStart on header + drop on cell calls moveWidget', async () => {
    const onMove = vi.fn()
    const cfg = { ...config(), onMove }
    const { container } = render(<IrisDashboard config={cfg} />)

    const header = container.querySelector('[data-iris-dashboard-widget-header="w1"]')!
    const targetCell = container.querySelector('[data-iris-dashboard-cell="2-2"]')!

    fireEvent.dragStart(header, { dataTransfer: { effectAllowed: 'move' } })
    fireEvent.dragOver(targetCell, { dataTransfer: { dropEffect: 'move' } })
    fireEvent.drop(targetCell, { dataTransfer: {} })

    expect(onMove).toHaveBeenCalledWith('w1', 2, 2)

    await vi.waitFor(() => {
      const w1 = container.querySelector('[data-iris-dashboard-widget="w1"]')!
      expect((w1 as HTMLElement).style.gridColumn).toContain('2')
    })
  })

  it('uses CSS grid layout on the container', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    const board = container.querySelector('[data-iris-dashboard]') as HTMLElement
    expect(board.style.display).toBe('grid')
    expect(board.style.gridTemplateColumns).toContain('1fr')
  })
})
