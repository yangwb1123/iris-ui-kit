import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTransfer, type IrisTransferItem, type IrisTransferVirtualOptions } from './Transfer'

afterEach(() => cleanup())

const VIRTUAL: IrisTransferVirtualOptions = { itemHeight: 32, height: 200 }

const makeItems = (n: number): IrisTransferItem[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `v${i}` }))

const listRoot = (c: HTMLElement): HTMLDivElement =>
  c.querySelector('[data-iris-transfer-list]') as HTMLDivElement
const itemsIn = (c: HTMLElement): NodeListOf<Element> =>
  c.querySelectorAll('[data-iris-transfer-item]')
const indicesIn = (c: HTMLElement): number[] =>
  Array.from(c.querySelectorAll('[data-iris-virtual-index]')).map((el) =>
    Number(el.getAttribute('data-iris-virtual-index')),
  )

describe('@iris-ui-kit/react IrisTransfer virtual panes', () => {
  it('V1: virtual off by default — no virtual scroller, all items rendered', () => {
    const { container } = render(<IrisTransfer options={makeItems(8)} />)
    expect(container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    expect(itemsIn(container).length).toBe(8)
  })

  it('V2: virtual on — both panes window to viewport + buffer', () => {
    const { container } = render(
      <IrisTransfer options={makeItems(10_000)} value={['v9999']} virtual={VIRTUAL} />,
    )
    const scrollers = container.querySelectorAll('[data-iris-virtual-scroll]')
    expect(scrollers.length).toBe(2)
    // jsdom clientHeight collapses to 0 after mount → buffer-only window (4);
    // pre-flush the numeric-height window is ceil(200/32)+4 = 11. Range, never exact.
    const src = container.querySelector('[data-iris-transfer-pane][data-side="source"]')!
    const srcCount = src.querySelectorAll('[data-iris-transfer-item]').length
    expect(srcCount).toBeGreaterThanOrEqual(1)
    expect(srcCount).toBeLessThanOrEqual(11)
    // data-iris-transfer-list lands on the virtual root (rest forwarding).
    for (const s of scrollers) {
      expect(s.getAttribute('data-iris-transfer-list')).not.toBeNull()
    }
  })

  it('V3: scroll drives the window to the 9993rd item', async () => {
    const { container } = render(<IrisTransfer options={makeItems(10_000)} virtual={VIRTUAL} />)
    const root = listRoot(container)
    root.scrollTop = 319_800 // startRaw = floor(319800/32) = 9993
    act(() => {
      fireEvent.scroll(root)
    })
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    const idx = indicesIn(container)
    expect(idx).toContain(9993)
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(9993 - 4)
    expect(Math.max(...idx)).toBeLessThanOrEqual(9993 + 4)
    expect(itemsIn(container).length).toBeLessThanOrEqual(11)
  })

  it('V4: moves still work in virtual mode (value-keyed selection survives windowing)', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTransfer options={makeItems(10_000)} virtual={VIRTUAL} onValueChange={onValueChange} />,
    )
    fireEvent.click(itemsIn(container)[0]!.querySelector('input')!)
    fireEvent.click(container.querySelector('[data-iris-transfer-to-target]')!)
    expect(onValueChange).toHaveBeenCalledWith(['v0'])
  })

  it('V5: empty pane keeps the plain empty-state list (no virtual scroller)', () => {
    const { container } = render(<IrisTransfer options={[]} virtual={VIRTUAL} />)
    expect(container.querySelectorAll('[data-iris-virtual-scroll]').length).toBe(0)
    expect(container.querySelectorAll('[data-iris-transfer-empty]').length).toBe(2)
  })

  it('V6: search filters inside virtual mode; count header stays full-pane', () => {
    const items = makeItems(10_000)
    const { container } = render(<IrisTransfer options={items} virtual={VIRTUAL} searchable />)
    const src = container.querySelector('[data-iris-transfer-pane][data-side="source"]')!
    fireEvent.change(src.querySelector('[data-iris-transfer-search]')!, {
      target: { value: 'Item 9999' },
    })
    expect(itemsIn(container).length).toBe(1)
    expect(src.querySelector('[data-iris-transfer-count]')!.textContent).toBe(`0/${items.length}`)
  })

  it('V7: disabled items stay disabled in virtual mode', () => {
    const items = makeItems(10)
    items[1] = { ...items[1]!, disabled: true }
    const { container } = render(<IrisTransfer options={items} virtual={VIRTUAL} />)
    const disabledInputs = Array.from(itemsIn(container)).filter(
      (li) => (li.querySelector('input') as HTMLInputElement).disabled,
    )
    expect(disabledInputs.length).toBe(1)
  })
})
