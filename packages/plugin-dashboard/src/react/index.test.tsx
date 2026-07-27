import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { IrisDashboard } from './index'
import type { DashboardConfig } from '../core'

afterEach(cleanup)

// jsdom drops clientX/clientY/pointerType from synthetic PointerEvents, so we
// dispatch a MouseEvent (which carries clientX/Y in jsdom) typed as a pointer
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

const stubRect = (el: Element, left: number, top: number) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width: 100,
    height: 100,
    right: left + 100,
    bottom: top + 100,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)

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

  it('maps a safe content key to interactive React content', () => {
    const onOpen = vi.fn()
    const cfg = config()
    cfg.widgets[0]!.contentKey = 'sales'
    const { getByRole } = render(
      <IrisDashboard
        config={cfg}
        renderWidget={(key) =>
          key === 'sales' ? <button onClick={onOpen}>Open sales</button> : null
        }
      />,
    )
    fireEvent.click(getByRole('button', { name: 'Open sales' }))
    expect(onOpen).toHaveBeenCalledOnce()
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

  it('touch: pointer-drag a widget header onto a cell calls moveWidget', () => {
    const onMove = vi.fn()
    const { container } = render(<IrisDashboard config={{ ...config(), onMove }} />)
    const header = container.querySelector('[data-iris-dashboard-widget-header="w1"]')!
    // Place cell "2-2" far from the others so closestCenter resolves to it.
    container.querySelectorAll<HTMLElement>('[data-iris-dashboard-cell]').forEach((cell) => {
      const id = cell.getAttribute('data-iris-dashboard-cell')!
      stubRect(cell, id === '2-2' ? 500 : 0, id === '2-2' ? 500 : 0)
    })

    pointer(header, 'pointerdown', { clientX: 10, clientY: 10 })
    pointer(header, 'pointermove', { clientX: 550, clientY: 550 })
    pointer(header, 'pointerup', { clientX: 550, clientY: 550 })

    expect(onMove).toHaveBeenCalledWith('w1', 2, 2)
  })

  it('touch: mouse pointers do NOT trigger the pointer path (native DnD owns mouse)', () => {
    const onMove = vi.fn()
    const { container } = render(<IrisDashboard config={{ ...config(), onMove }} />)
    const header = container.querySelector('[data-iris-dashboard-widget-header="w1"]')!
    container.querySelectorAll<HTMLElement>('[data-iris-dashboard-cell]').forEach((cell) => {
      const id = cell.getAttribute('data-iris-dashboard-cell')!
      stubRect(cell, id === '2-2' ? 500 : 0, id === '2-2' ? 500 : 0)
    })

    pointer(header, 'pointerdown', { clientX: 10, clientY: 10, pointerType: 'mouse' })
    pointer(header, 'pointermove', { clientX: 550, clientY: 550, pointerType: 'mouse' })
    pointer(header, 'pointerup', { clientX: 550, clientY: 550, pointerType: 'mouse' })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('uses CSS grid layout on the container', () => {
    const { container } = render(<IrisDashboard config={config()} />)
    const board = container.querySelector('[data-iris-dashboard]') as HTMLElement
    expect(board.style.display).toBe('grid')
    expect(board.style.gridTemplateColumns).toContain('1fr')
  })
})
