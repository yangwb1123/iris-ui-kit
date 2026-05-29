import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCascader, type IrisCascaderNode } from './Cascader'

afterEach(() => cleanup())

const OPTIONS: IrisCascaderNode[] = [
  {
    label: 'Zhejiang',
    value: 'zj',
    children: [{ label: 'Hangzhou', value: 'hz', children: [{ label: 'West Lake', value: 'wl' }] }],
  },
  { label: 'Jiangsu', value: 'js', children: [{ label: 'Nanjing', value: 'nj' }] },
]

const trigger = (c: HTMLElement) => c.querySelector('[data-iris-cascader-trigger]') as HTMLElement
const columns = (c: HTMLElement) => c.querySelectorAll('[data-iris-cascader-column]')

describe('@iris-ui/react IrisCascader', () => {
  it('shows the placeholder, closed initially', () => {
    const { container } = render(<IrisCascader options={OPTIONS} placeholder="Pick" />)
    expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
    expect(container.querySelector('[data-iris-cascader-value]')?.textContent).toBe('Pick')
  })

  it('opens to the root column', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    expect(columns(container).length).toBe(1)
    expect(columns(container)[0].querySelectorAll('[data-iris-cascader-option]').length).toBe(2)
  })

  it('clicking a branch reveals the next column', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-iris-cascader-option][data-value="zj"]')!)
    expect(columns(container).length).toBe(2)
    expect(container.querySelector('[data-value="hz"]')).not.toBeNull()
  })

  it('clicking a leaf commits the path and closes', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisCascader options={OPTIONS} onValueChange={onValueChange} />)
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-value="js"]')!)
    fireEvent.click(container.querySelector('[data-value="nj"]')!)
    expect(onValueChange).toHaveBeenCalledWith(['js', 'nj'])
    expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
  })

  it('renders the selected path in the trigger', () => {
    const { container } = render(<IrisCascader options={OPTIONS} value={['zj', 'hz', 'wl']} />)
    expect(container.querySelector('[data-iris-cascader-value]')?.textContent).toBe(
      'Zhejiang / Hangzhou / West Lake',
    )
  })

  it('a11y: trigger haspopup + expanded toggles', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    const t = trigger(container)
    expect(t.getAttribute('aria-haspopup')).toBe('listbox')
    expect(t.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(t)
    expect(t.getAttribute('aria-expanded')).toBe('true')
  })
})
