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
const panel = (c: HTMLElement) => c.querySelector('[data-iris-cascader-panel]')
const valueEl = (c: HTMLElement) => c.querySelector('[data-iris-cascader-value]')

describe('@iris-ui-kit/react IrisCascader', () => {
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

  it('disabled trigger has disabled attribute', () => {
    const { container } = render(<IrisCascader options={OPTIONS} disabled />)
    expect(trigger(container).hasAttribute('disabled')).toBe(true)
  })

  it('Escape closes the panel', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    expect(container.querySelector('[data-iris-cascader-panel]')).not.toBeNull()
    fireEvent.keyDown(trigger(container), { key: 'Escape' })
    expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
  })

  it('custom separator renders in trigger value', () => {
    const { container } = render(
      <IrisCascader options={OPTIONS} value={['zj', 'hz']} separator=" > " />,
    )
    expect(valueEl(container)?.textContent).toBe('Zhejiang > Hangzhou')
  })

  it('data-state transitions open/closed', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    const root = container.querySelector('[data-iris-cascader]')
    expect(root?.getAttribute('data-state')).toBe('closed')
    fireEvent.click(trigger(container))
    expect(root?.getAttribute('data-state')).toBe('open')
    fireEvent.keyDown(trigger(container), { key: 'Escape' })
    expect(root?.getAttribute('data-state')).toBe('closed')
  })

  it('aria-invalid when invalid', () => {
    const { container } = render(<IrisCascader options={OPTIONS} invalid />)
    expect(trigger(container).getAttribute('aria-invalid')).toBe('true')
  })

  it('ArrowDown opens the panel when closed', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    expect(panel(container)).toBeNull()
    fireEvent.keyDown(trigger(container), { key: 'ArrowDown' })
    expect(panel(container)).not.toBeNull()
  })

  it('updates value display after selection', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-value="js"]')!)
    fireEvent.click(container.querySelector('[data-value="nj"]')!)
    expect(valueEl(container)?.textContent).toBe('Jiangsu / Nanjing')
  })

  it('shows multiple cascading columns for deep trees', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    // Click Zhejiang → see second column
    fireEvent.click(container.querySelector('[data-value="zj"]')!)
    expect(columns(container).length).toBe(2)
    // Click Hangzhou → see third column
    fireEvent.click(container.querySelector('[data-value="hz"]')!)
    expect(columns(container).length).toBe(3)
    expect(container.querySelector('[data-value="wl"]')).not.toBeNull()
  })

  it('handles empty options', () => {
    const { container } = render(<IrisCascader options={[]} />)
    fireEvent.click(trigger(container))
    // Should not crash
    expect(panel(container)).not.toBeNull()
  })
})
