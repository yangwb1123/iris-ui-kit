import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import {
  IrisTransfer,
  type IrisTransferItem,
  type IrisTransferVirtualOptions,
} from './IrisTransfer'

afterEach(cleanup)

const VIRTUAL: IrisTransferVirtualOptions = { itemHeight: 32, height: 200 }

const makeItems = (n: number): IrisTransferItem[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `v${i}` }))

const itemsIn = (container: HTMLElement) => container.querySelectorAll('[data-iris-transfer-item]')
const indicesIn = (container: HTMLElement): number[] =>
  Array.from(container.querySelectorAll('[data-iris-virtual-index]')).map((el) =>
    Number(el.getAttribute('data-iris-virtual-index')),
  )

describe('IrisTransfer virtual panes (solid)', () => {
  it('V1: virtual off by default — no virtual scroller, all items rendered', () => {
    const { container } = render(() => <IrisTransfer options={makeItems(8)} />)
    expect(container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    expect(itemsIn(container).length).toBe(8)
  })

  it('V2: virtual on — both panes window to viewport + buffer', () => {
    const { container } = render(() => (
      <IrisTransfer options={makeItems(10_000)} value={['v9999']} virtual={VIRTUAL} />
    ))
    const scrollers = container.querySelectorAll('[data-iris-virtual-scroll]')
    expect(scrollers.length).toBe(2)
    // jsdom clientHeight collapses to 0 after mount → buffer-only window (4);
    // pre-flush the numeric-height window is ceil(200/32)+4 = 11. Range, never exact.
    const src = container.querySelector('[data-iris-transfer-panel="source"]')!
    const srcCount = src.querySelectorAll('[data-iris-transfer-item]').length
    expect(srcCount).toBeGreaterThanOrEqual(1)
    expect(srcCount).toBeLessThanOrEqual(11)
    // ARIA listbox role lands on the virtual root (rest forwarding).
    for (const s of scrollers) {
      expect(s.getAttribute('role')).toBe('listbox')
      expect(s.getAttribute('aria-multiselectable')).toBe('true')
    }
  })

  it('V3: scroll drives the window to the 9993rd item', async () => {
    const { container } = render(() => (
      <IrisTransfer options={makeItems(10_000)} virtual={VIRTUAL} />
    ))
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    root.scrollTop = 319_800 // startRaw = floor(319800/32) = 9993
    fireEvent.scroll(root)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const idx = indicesIn(container)
    expect(idx).toContain(9993)
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(9993 - 4)
    expect(Math.max(...idx)).toBeLessThanOrEqual(9993 + 4)
    expect(itemsIn(container).length).toBeLessThanOrEqual(11)
  })

  it('V4: moves still work in virtual mode (value-keyed selection survives windowing)', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTransfer options={makeItems(10_000)} virtual={VIRTUAL} onChange={onChange} />
    ))
    const firstInput = container.querySelector(
      '[data-iris-transfer-item] input[type="checkbox"]',
    ) as HTMLInputElement
    fireEvent.click(firstInput)
    fireEvent.click(container.querySelector('[data-iris-transfer-move-right]')!)
    expect(onChange).toHaveBeenCalledWith(['v0'])
  })

  it('V5: empty pane renders no virtual scroller (falls back to the plain list)', () => {
    const { container } = render(() => <IrisTransfer options={[]} virtual={VIRTUAL} />)
    expect(container.querySelectorAll('[data-iris-virtual-scroll]').length).toBe(0)
    expect(itemsIn(container).length).toBe(0)
  })

  it('V6: search filters inside virtual mode; count header stays the pane count', async () => {
    const items = makeItems(10_000)
    const { container } = render(() => (
      <IrisTransfer options={items} virtual={VIRTUAL} searchable />
    ))
    const src = container.querySelector('[data-iris-transfer-panel="source"]')!
    const input = src.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'Item 9999' } })
    expect(src.querySelectorAll('[data-iris-transfer-item]').length).toBe(1)
    // Solid's pane count is the (query-filtered) pane length — unchanged from
    // the non-virtual path; the single match is rendered via the virtual window.
    const count = src.querySelector('span[style*="margin-left"]')!
    expect(count.textContent).toBe('0/1')
  })

  it('V7: disabled items stay disabled in virtual mode', () => {
    const items = makeItems(10)
    items[1] = { ...items[1]!, disabled: true }
    const { container } = render(() => <IrisTransfer options={items} virtual={VIRTUAL} />)
    const disabledInputs = Array.from(itemsIn(container)).filter(
      (el) => (el.querySelector('input') as HTMLInputElement).disabled,
    )
    expect(disabledInputs.length).toBe(1)
  })
})
