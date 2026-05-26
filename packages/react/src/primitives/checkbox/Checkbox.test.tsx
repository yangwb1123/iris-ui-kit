import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCheckbox } from './Checkbox'

afterEach(() => cleanup())

describe('@iris-ui/react IrisCheckbox', () => {
  it('renders an <input type="checkbox">', () => {
    const { container } = render(<IrisCheckbox />)
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull()
  })

  it('uncontrolled toggles internal state', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisCheckbox onChange={onChange} />)
    const input = container.querySelector('input')!
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalled()
  })

  it('controlled honors prop', () => {
    const { container, rerender } = render(<IrisCheckbox checked={false} />)
    expect(container.querySelector('input')!.checked).toBe(false)
    rerender(<IrisCheckbox checked={true} />)
    expect(container.querySelector('input')!.checked).toBe(true)
  })

  it('indeterminate state sets aria-checked="mixed"', () => {
    const { container } = render(<IrisCheckbox checked="indeterminate" />)
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('mixed')
    expect(container.querySelector('[data-iris-checkbox]')!.getAttribute('data-state')).toBe('indeterminate')
  })

  it('indeterminate flag is applied to the native input', () => {
    const { container } = render(<IrisCheckbox checked="indeterminate" />)
    expect((container.querySelector('input') as HTMLInputElement).indeterminate).toBe(true)
  })

  it('disabled blocks change', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisCheckbox disabled onChange={onChange} />)
    fireEvent.click(container.querySelector('input')!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders children as label', () => {
    const { container } = render(<IrisCheckbox>Agree</IrisCheckbox>)
    expect(container.textContent).toContain('Agree')
  })

  it('invalid → aria-invalid + ariaDescribedby forwarded', () => {
    const { container } = render(<IrisCheckbox invalid ariaDescribedby="err" />)
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('err')
  })

  it('size flips data attr', () => {
    const { container } = render(<IrisCheckbox size="lg" />)
    expect(container.querySelector('[data-iris-checkbox]')!.getAttribute('data-iris-checkbox-size')).toBe('lg')
  })

  it('checked indicator renders ✓', () => {
    const { container } = render(<IrisCheckbox checked={true} />)
    expect(container.textContent).toContain('✓')
  })
})
