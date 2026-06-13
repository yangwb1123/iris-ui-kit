import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisSwitch } from './Switch'

afterEach(cleanup)

describe('@iris-ui/solid IrisSwitch', () => {
  it('renders an input with role=switch', () => {
    const { container } = render(() => <IrisSwitch />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('type')).toBe('checkbox')
    expect(input.getAttribute('role')).toBe('switch')
  })

  it('uncontrolled toggles internal state', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisSwitch defaultChecked onChange={onChange} />)
    const input = container.querySelector('input')!
    expect(input.checked).toBe(true)
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(false, expect.anything())
    expect(input.checked).toBe(false)
  })

  it('controlled honors prop (signal-driven), ignores own state', () => {
    const [checked, setChecked] = createSignal(false)
    const { container } = render(() => <IrisSwitch checked={checked()} />)
    expect(container.querySelector('input')!.checked).toBe(false)
    setChecked(true)
    expect(container.querySelector('input')!.checked).toBe(true)
    setChecked(false)
    expect(container.querySelector('input')!.checked).toBe(false)
  })

  it('controlled change reports via onChange but does not mutate internal state', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisSwitch checked={false} onChange={onChange} />)
    const input = container.querySelector('input')!
    fireEvent.click(input)
    // onChange fires with the proposed value, but value() stays prop-driven
    expect(onChange).toHaveBeenCalledWith(true, expect.anything())
    expect(input.getAttribute('aria-checked')).toBe('false')
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'unchecked',
    )
  })

  it('disabled blocks change', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisSwitch disabled onChange={onChange} />)
    fireEvent.click(container.querySelector('input')!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('aria-checked reflects state', () => {
    const [checked, setChecked] = createSignal(false)
    const { container } = render(() => <IrisSwitch checked={checked()} />)
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('false')
    setChecked(true)
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('true')
  })

  it('invalid → aria-invalid', () => {
    const { container } = render(() => <IrisSwitch invalid />)
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(() => <IrisSwitch ariaDescribedby="hint" />)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('hint')
  })

  it('data-state reflects checked', () => {
    const [checked, setChecked] = createSignal(false)
    const { container } = render(() => <IrisSwitch checked={checked()} />)
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'unchecked',
    )
    setChecked(true)
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'checked',
    )
  })
})
