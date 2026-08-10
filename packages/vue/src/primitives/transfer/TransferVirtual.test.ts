import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTransfer, type IrisTransferItem, type IrisTransferVirtualOptions } from './Transfer'

const VIRTUAL: IrisTransferVirtualOptions = { itemHeight: 32, height: 200 }

const makeItems = (n: number): IrisTransferItem[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `v${i}` }))

const flushRaf = async (): Promise<void> => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await Promise.resolve()
}

describe('IrisTransfer virtual panes (vue)', () => {
  it('V1: virtual off by default — no virtual scroller, all items rendered', () => {
    const w = mount(IrisTransfer, { props: { options: makeItems(8) } })
    expect(w.find('[data-iris-virtual-scroll]').exists()).toBe(false)
    expect(w.findAll('[data-iris-transfer-item]').length).toBe(8)
  })

  it('V2: virtual on — both panes window to viewport + buffer', () => {
    const w = mount(IrisTransfer, {
      props: { options: makeItems(10_000), modelValue: ['v9999'], virtual: VIRTUAL },
    })
    expect(w.findAll('[data-iris-virtual-scroll]').length).toBe(2)
    // jsdom clientHeight collapses to 0 after mount → buffer-only window (4);
    // pre-flush the numeric-height window is ceil(200/32)+4 = 11. Range, never exact.
    const src = w.find('[data-iris-transfer-pane][data-side="source"]')
    const srcCount = src.findAll('[data-iris-transfer-item]').length
    expect(srcCount).toBeGreaterThanOrEqual(1)
    expect(srcCount).toBeLessThanOrEqual(11)
    // data-iris-transfer-list lands on the virtual root (attrs forwarding).
    expect(src.find('[data-iris-transfer-list]').exists()).toBe(true)
  })

  it('V3: scroll drives the window to the 9993rd item', async () => {
    const w = mount(IrisTransfer, { props: { options: makeItems(10_000), virtual: VIRTUAL } })
    const root = w.find('[data-iris-transfer-list]').element as HTMLDivElement
    root.scrollTop = 319_800 // startRaw = floor(319800/32) = 9993
    root.dispatchEvent(new Event('scroll'))
    await flushRaf()
    const idx = Array.from(
      w
        .find('[data-iris-transfer-pane][data-side="source"]')
        .element.querySelectorAll('[data-iris-virtual-index]'),
    ).map((el) => Number(el.getAttribute('data-iris-virtual-index')))
    expect(idx).toContain(9993)
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(9993 - 4)
    expect(Math.max(...idx)).toBeLessThanOrEqual(9993 + 4)
    expect(w.findAll('[data-iris-transfer-item]').length).toBeLessThanOrEqual(11)
  })

  it('V4: moves still work in virtual mode (value-keyed selection survives windowing)', async () => {
    const w = mount(IrisTransfer, { props: { options: makeItems(10_000), virtual: VIRTUAL } })
    const first = w.find('[data-iris-transfer-pane][data-side="source"] [data-iris-transfer-item]')
    await first.find('input').setValue(true)
    await w.find('[data-iris-transfer-to-target]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['v0']])
  })

  it('V5: empty pane keeps the plain empty-state list (no virtual scroller)', () => {
    const w = mount(IrisTransfer, { props: { options: [], virtual: VIRTUAL } })
    expect(w.findAll('[data-iris-virtual-scroll]').length).toBe(0)
    expect(w.findAll('[data-iris-transfer-empty]').length).toBe(2)
  })

  it('V6: search filters inside virtual mode; count header stays full-pane', async () => {
    const items = makeItems(10_000)
    const w = mount(IrisTransfer, {
      props: { options: items, virtual: VIRTUAL, searchable: true },
    })
    const src = w.find('[data-iris-transfer-pane][data-side="source"]')
    await src.find('[data-iris-transfer-search]').setValue('Item 9999')
    expect(src.findAll('[data-iris-transfer-item]').length).toBe(1)
    expect(src.find('[data-iris-transfer-count]').text()).toBe(`0/${items.length}`)
  })
})
