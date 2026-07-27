import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import IrisDashboard from './IrisDashboard.svelte'
import DashboardContentHarness from './DashboardContentHarness.svelte'
import type { DashboardConfig } from '../core'

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

  it('maps a safe content key to an interactive Svelte snippet', async () => {
    const onOpen = vi.fn()
    const cfg = config()
    cfg.widgets[0]!.contentKey = 'sales'
    const { container } = render(DashboardContentHarness, { props: { config: cfg, onOpen } })
    const button = container.querySelector('[data-sales]')!
    expect(button.textContent?.trim()).toBe('Open sales')
    await fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledOnce()
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

  it('touch: pointer-drag a widget header onto a cell calls moveWidget', () => {
    const onMove = vi.fn()
    const { container } = render(IrisDashboard, { props: { config: { ...config(), onMove } } })
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

  it('touch: a tap (no movement past threshold) does NOT move/reorder', () => {
    const onMove = vi.fn()
    const { container } = render(IrisDashboard, { props: { config: { ...config(), onMove } } })
    const header = container.querySelector('[data-iris-dashboard-widget-header="w1"]')!
    container.querySelectorAll<HTMLElement>('[data-iris-dashboard-cell]').forEach((cell) => {
      const id = cell.getAttribute('data-iris-dashboard-cell')!
      stubRect(cell, id === '2-2' ? 500 : 0, id === '2-2' ? 500 : 0)
    })

    // down then up at the same point (a tap) — and a sub-threshold jitter move.
    pointer(header, 'pointerdown', { clientX: 10, clientY: 10 })
    pointer(header, 'pointermove', { clientX: 12, clientY: 11 })
    pointer(header, 'pointerup', { clientX: 12, clientY: 11 })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('touch: mouse pointers do NOT trigger the pointer path (native DnD owns mouse)', () => {
    const onMove = vi.fn()
    const { container } = render(IrisDashboard, { props: { config: { ...config(), onMove } } })
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
})
