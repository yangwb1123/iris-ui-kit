import { render, fireEvent } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisTransfer, {
  type IrisTransferItem,
  type IrisTransferVirtualOptions,
} from './IrisTransfer.svelte'

const VIRTUAL: IrisTransferVirtualOptions = { itemHeight: 32, height: 200 }

const makeItems = (n: number): IrisTransferItem[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `v${i}` }))

const scrollers = (c: HTMLElement) => c.querySelectorAll('[data-iris-virtual-scroll]')
const labelsIn = (c: HTMLElement) => c.querySelectorAll('[data-iris-transfer-source] label')
const indicesIn = (c: HTMLElement): number[] =>
  Array.from(c.querySelectorAll('[data-iris-virtual-index]')).map((el) =>
    Number(el.getAttribute('data-iris-virtual-index')),
  )

describe('IrisTransfer virtual panes (svelte)', () => {
  it('V1: virtual off by default — no virtual scroller, all items rendered', () => {
    const { container } = render(IrisTransfer, { props: { options: makeItems(8) } })
    expect(scrollers(container).length).toBe(0)
    expect(labelsIn(container).length).toBe(8)
  })

  it('V2: virtual on — both panes window to viewport + buffer', async () => {
    const { container } = render(IrisTransfer, {
      props: { options: makeItems(10_000), value: ['v9999'], virtual: VIRTUAL },
    })
    await tick()
    expect(scrollers(container).length).toBe(2)
    // jsdom keeps the numeric height in this bridge → post-flush window is
    // ceil(200/32)+4 = 11. Range, never exact.
    const srcCount = labelsIn(container).length
    expect(srcCount).toBeGreaterThanOrEqual(1)
    expect(srcCount).toBeLessThanOrEqual(11)
  })

  it('V3: scroll drives the window to the 9993rd item', async () => {
    const { container } = render(IrisTransfer, {
      props: { options: makeItems(10_000), virtual: VIRTUAL },
    })
    await tick()
    const root = container.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
    root.scrollTop = 319_800 // startRaw = floor(319800/32) = 9993
    root.dispatchEvent(new Event('scroll'))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await tick()
    const idx = indicesIn(container)
    expect(idx).toContain(9993)
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(9993 - 4)
    // This bridge keeps the numeric viewport height in jsdom (Svelte's
    // measureViewport preserves a configured numeric height), so the window
    // also covers ceil(200/32)+4 below the scroll anchor — capped by the list.
    expect(Math.max(...idx)).toBeLessThan(10_000)
    expect(labelsIn(container).length).toBeLessThanOrEqual(11)
  })

  it('V4: moves still work in virtual mode (value-keyed selection survives windowing)', async () => {
    let changed: string[] | null = null
    const { container } = render(IrisTransfer, {
      props: {
        options: makeItems(10_000),
        value: [],
        virtual: VIRTUAL,
        onValueChange: (v: string[]) => {
          changed = v
        },
      },
    })
    await tick()
    const firstInput = container.querySelector(
      '[data-iris-transfer-source] label input[type="checkbox"]',
    ) as HTMLInputElement
    await fireEvent.click(firstInput)
    await fireEvent.click(container.querySelector('[data-iris-transfer-move-right]') as HTMLElement)
    expect(changed).toEqual(['v0'])
  })

  it('V5: empty pane keeps the plain empty-state list (no virtual scroller)', async () => {
    const { container } = render(IrisTransfer, { props: { options: [], virtual: VIRTUAL } })
    await tick()
    expect(scrollers(container).length).toBe(0)
    expect(container.textContent?.match(/No items to transfer/g)?.length).toBe(2)
  })

  it('V6: search filters inside virtual mode; count header stays the pane count', async () => {
    const items = makeItems(10_000)
    const { container } = render(IrisTransfer, {
      props: { options: items, virtual: VIRTUAL, searchable: true },
    })
    await tick()
    const input = container.querySelector(
      '[data-iris-transfer-source] input[type="text"]',
    ) as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'Item 9999' } })
    await tick()
    // Svelte's pane count is the (query-filtered) pane length — unchanged from
    // the non-virtual path; the single match renders via the virtual window.
    expect(labelsIn(container).length).toBe(1)
    const count = container.querySelector('[data-iris-transfer-source] span[style*="margin-left"]')!
    expect(count.textContent).toBe('0/1')
  })

  it('V7: disabled items stay disabled in virtual mode', async () => {
    const items = makeItems(10)
    items[1] = { ...items[1]!, disabled: true }
    const { container } = render(IrisTransfer, { props: { options: items, virtual: VIRTUAL } })
    await tick()
    const disabledInputs = Array.from(labelsIn(container)).filter(
      (el) => (el.querySelector('input') as HTMLInputElement).disabled,
    )
    expect(disabledInputs.length).toBe(1)
  })
})
