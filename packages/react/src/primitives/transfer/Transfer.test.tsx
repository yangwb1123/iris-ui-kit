import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTransfer, type IrisTransferItem } from './Transfer'

afterEach(() => cleanup())

const OPTIONS: IrisTransferItem[] = [
  { label: 'Apple', value: 'a' },
  { label: 'Banana', value: 'b' },
  { label: 'Cherry', value: 'c' },
  { label: 'Durian', value: 'd', disabled: true },
]

const panes = (c: HTMLElement) => c.querySelectorAll('[data-iris-transfer-pane]')
const itemsIn = (pane: Element) => pane.querySelectorAll('[data-iris-transfer-item]')

describe('@iris-ui/react IrisTransfer', () => {
  it('splits options into available and selected panes', () => {
    const { container } = render(<IrisTransfer options={OPTIONS} value={['b']} />)
    const [src, tgt] = panes(container)
    expect(itemsIn(src).length).toBe(3)
    expect(itemsIn(tgt).length).toBe(1)
  })

  it('moves a checked source item to the target', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTransfer options={OPTIONS} value={[]} onValueChange={onValueChange} />,
    )
    fireEvent.click(itemsIn(panes(container)[0])[0].querySelector('input')!)
    fireEvent.click(container.querySelector('[data-iris-transfer-to-target]')!)
    expect(onValueChange).toHaveBeenCalledWith(['a'])
  })

  it('moves a checked target item back to the source', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTransfer options={OPTIONS} value={['a', 'b']} onValueChange={onValueChange} />,
    )
    fireEvent.click(itemsIn(panes(container)[1])[0].querySelector('input')!)
    fireEvent.click(container.querySelector('[data-iris-transfer-to-source]')!)
    expect(onValueChange).toHaveBeenCalledWith(['b'])
  })

  it('disables move buttons when nothing is checked', () => {
    const { container } = render(<IrisTransfer options={OPTIONS} value={[]} />)
    expect(
      (container.querySelector('[data-iris-transfer-to-target]') as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('filters a pane via search', () => {
    const { container } = render(<IrisTransfer options={OPTIONS} value={[]} searchable />)
    const src = panes(container)[0]
    fireEvent.change(src.querySelector('[data-iris-transfer-search]')!, {
      target: { value: 'ban' },
    })
    expect(itemsIn(panes(container)[0]).length).toBe(1)
  })

  it('select-all moves every enabled item (disabled excluded)', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTransfer options={OPTIONS} value={[]} onValueChange={onValueChange} />,
    )
    fireEvent.click(panes(container)[0].querySelector('[data-iris-transfer-select-all]')!)
    fireEvent.click(container.querySelector('[data-iris-transfer-to-target]')!)
    expect(onValueChange).toHaveBeenCalledWith(['a', 'b', 'c'])
  })

  it('disabled items are not selectable', () => {
    const { container } = render(<IrisTransfer options={OPTIONS} value={[]} />)
    const durian = Array.from(itemsIn(panes(container)[0])).find(
      (li) => li.getAttribute('data-value') === 'd',
    )!
    expect((durian.querySelector('input') as HTMLInputElement).disabled).toBe(true)
  })

  it('a11y: move buttons have accessible labels', () => {
    const { container } = render(<IrisTransfer options={OPTIONS} value={[]} />)
    expect(
      container.querySelector('[data-iris-transfer-to-target]')?.getAttribute('aria-label'),
    ).toBe('Move to selected')
    expect(
      container.querySelector('[data-iris-transfer-to-source]')?.getAttribute('aria-label'),
    ).toBe('Move to available')
  })
})
