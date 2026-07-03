import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCascader } from './IrisCascader'

afterEach(cleanup)

const options = [
  {
    label: 'Fruits',
    value: 'fruits',
    children: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ],
  },
  {
    label: 'Vegetables',
    value: 'vegetables',
    children: [{ label: 'Carrot', value: 'carrot' }],
  },
]

function triggerEl(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-cascader-trigger]') as HTMLButtonElement
}
function dropdownEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-cascader-dropdown]')
}
function getOptions(container: HTMLElement, col: number = 0): HTMLElement[] {
  return Array.from(
    container.querySelectorAll(`[data-iris-cascader-column="${col}"] [data-iris-cascader-option]`),
  )
}

describe('IrisCascader', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    expect(container.querySelector('[data-iris-cascader]')).not.toBeNull()
  })

  it('opens dropdown on trigger click', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    expect(dropdownEl(container)).toBeNull()
    fireEvent.click(triggerEl(container))
    expect(dropdownEl(container)).not.toBeNull()
  })

  it('trigger has aria-haspopup=listbox and opens on ArrowDown / closes on Escape', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    const trigger = triggerEl(container)
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(dropdownEl(container)).not.toBeNull()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(dropdownEl(container)).toBeNull()
  })

  it('shows first level options when open', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    fireEvent.click(triggerEl(container))
    const opts = getOptions(container, 0)
    expect(opts.length).toBeGreaterThanOrEqual(2)
    expect(opts[0]?.textContent).toContain('Fruits')
  })

  it('calls onChange when leaf selected', () => {
    const onChange = vi.fn()
    const leafOptions = [{ label: 'Direct', value: 'direct' }]
    const { container } = render(() => <IrisCascader options={leafOptions} onChange={onChange} />)
    fireEvent.click(triggerEl(container))
    const opt = container.querySelector('[data-iris-cascader-option="direct"]') as HTMLElement
    fireEvent.click(opt)
    expect(onChange).toHaveBeenCalledWith(['direct'])
  })

  describe('ARIA attributes', () => {
    it('has aria-expanded on trigger', () => {
      const { container } = render(() => <IrisCascader options={options} />)
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(trigger)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })

    it('has aria-invalid when invalid', () => {
      const { container } = render(() => <IrisCascader options={options} invalid />)
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('aria-invalid')).toBe('true')
    })

    it('has data-state open/closed', () => {
      const { container } = render(() => <IrisCascader options={options} />)
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('data-state')).toBe('closed')
      fireEvent.click(trigger)
      expect(trigger.getAttribute('data-state')).toBe('open')
    })
  })

  describe('multi-level navigation', () => {
    it('opens second column when clicking a parent option', () => {
      const { container } = render(() => <IrisCascader options={options} />)
      fireEvent.click(triggerEl(container))
      // Click "Fruits" parent
      const fruits = container.querySelector('[data-iris-cascader-option="fruits"]') as HTMLElement
      fireEvent.click(fruits)
      // Second column should appear with children
      const col2Options = getOptions(container, 1)
      expect(col2Options.length).toBe(2) // Apple, Banana
      expect(col2Options[0]?.textContent).toContain('Apple')
    })

    it('selects a deep leaf node', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisCascader options={options} onChange={onChange} />)
      fireEvent.click(triggerEl(container))
      // Navigate to second level
      const fruits = container.querySelector('[data-iris-cascader-option="fruits"]') as HTMLElement
      fireEvent.click(fruits)
      // Select Apple
      const apple = container.querySelector('[data-iris-cascader-option="apple"]') as HTMLElement
      fireEvent.click(apple)
      expect(onChange).toHaveBeenCalledWith(['fruits', 'apple'])
    })
  })

  describe('controlled mode', () => {
    it('displays the selected label on the trigger', () => {
      const { container } = render(() => (
        <IrisCascader options={options} value={['vegetables', 'carrot']} />
      ))
      const trigger = triggerEl(container)
      expect(trigger.textContent).toContain('Carrot')
    })
  })

  describe('states', () => {
    it('disables the trigger when disabled', () => {
      const { container } = render(() => <IrisCascader options={options} disabled />)
      expect(triggerEl(container).hasAttribute('disabled')).toBe(true)
    })

    it('sets data-disabled on container', () => {
      const { container } = render(() => <IrisCascader options={options} disabled />)
      const el = container.querySelector('[data-iris-cascader]')
      expect(el?.getAttribute('data-disabled')).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles empty options', () => {
      const { container } = render(() => <IrisCascader options={[]} />)
      fireEvent.click(triggerEl(container))
      // Should not crash with empty options
      expect(dropdownEl(container)).not.toBeNull()
    })

    it('does not crash with no options prop', () => {
      const { container } = render(() => <IrisCascader />)
      expect(container.querySelector('[data-iris-cascader]')).not.toBeNull()
    })
  })
})
