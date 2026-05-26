import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSwitch } from './Switch'

afterEach(() => cleanup())

describe('@iris-ui/react IrisSwitch', () => {
  it('renders an input with role=switch', () => {
    const { container } = render(<IrisSwitch />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('type')).toBe('checkbox')
    expect(input.getAttribute('role')).toBe('switch')
  })

  it('uncontrolled toggles internal state', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisSwitch defaultChecked onChange={onChange} />)
    const input = container.querySelector('input')!
    expect(input.checked).toBe(true)
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(false, expect.anything())
    expect(input.checked).toBe(false)
  })

  it('controlled honors prop, ignores own state', () => {
    const { container, rerender } = render(<IrisSwitch checked={false} />)
    expect(container.querySelector('input')!.checked).toBe(false)
    rerender(<IrisSwitch checked={true} />)
    expect(container.querySelector('input')!.checked).toBe(true)
  })

  it('disabled blocks change', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisSwitch disabled onChange={onChange} />)
    fireEvent.click(container.querySelector('input')!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('aria-checked reflects state', () => {
    const { container, rerender } = render(<IrisSwitch checked={false} />)
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('false')
    rerender(<IrisSwitch checked={true} />)
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('true')
  })

  it('invalid → aria-invalid', () => {
    const { container } = render(<IrisSwitch invalid />)
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(<IrisSwitch ariaDescribedby="hint" />)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('hint')
  })

  it('data-state reflects checked', () => {
    const { container, rerender } = render(<IrisSwitch checked={false} />)
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe('unchecked')
    rerender(<IrisSwitch checked={true} />)
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe('checked')
  })
})
