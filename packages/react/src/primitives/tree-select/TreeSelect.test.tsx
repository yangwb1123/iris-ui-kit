import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTreeSelect, type IrisTreeSelectNode } from './TreeSelect'

afterEach(() => cleanup())

const OPTIONS: IrisTreeSelectNode[] = [
  {
    label: 'Fruits',
    value: 'fruits',
    children: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana', disabled: true },
    ],
  },
  { label: 'Veggies', value: 'veg', children: [{ label: 'Carrot', value: 'carrot' }] },
]

const trigger = (c: HTMLElement) =>
  c.querySelector('[data-iris-tree-select-trigger]') as HTMLElement
const nodes = (c: HTMLElement) => c.querySelectorAll('[data-iris-tree-select-node]')

describe('@iris-ui/react IrisTreeSelect', () => {
  it('shows the placeholder, closed initially', () => {
    const { container } = render(<IrisTreeSelect options={OPTIONS} placeholder="Pick" />)
    expect(container.querySelector('[role="tree"]')).toBeNull()
    expect(container.querySelector('[data-iris-tree-select-value]')?.textContent).toBe('Pick')
    expect(trigger(container).getAttribute('aria-haspopup')).toBe('tree')
  })

  it('opens the tree showing root nodes only (collapsed)', () => {
    const { container } = render(<IrisTreeSelect options={OPTIONS} />)
    fireEvent.click(trigger(container))
    expect(container.querySelector('[role="tree"]')).not.toBeNull()
    expect(nodes(container).length).toBe(2)
  })

  it('expands a node to reveal children', () => {
    const { container } = render(<IrisTreeSelect options={OPTIONS} />)
    fireEvent.click(trigger(container))
    fireEvent.click(
      container.querySelector('[data-value="fruits"] [data-iris-tree-select-toggle]')!,
    )
    expect(container.querySelector('[data-value="apple"]')).not.toBeNull()
  })

  it('selects a leaf node, sets the value, and closes', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTreeSelect
        options={OPTIONS}
        defaultExpanded={['fruits']}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-value="apple"] [data-iris-tree-select-label]')!)
    expect(onValueChange).toHaveBeenCalledWith('apple')
    expect(container.querySelector('[role="tree"]')).toBeNull()
  })

  it('reflects the selected value (nested) in the trigger', () => {
    const { container } = render(<IrisTreeSelect options={OPTIONS} value="carrot" />)
    expect(container.querySelector('[data-iris-tree-select-value]')?.textContent).toBe('Carrot')
  })

  it('does not select a disabled node', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTreeSelect
        options={OPTIONS}
        defaultExpanded={['fruits']}
        onValueChange={onValueChange}
      />,
    )
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-value="banana"] [data-iris-tree-select-label]')!)
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
