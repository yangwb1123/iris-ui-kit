import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisSwitch from './Switch.svelte'

describe('@iris-ui/svelte IrisSwitch', () => {
  it('renders an input with role=switch', () => {
    const { container } = render(IrisSwitch)
    const input = container.querySelector('input')!
    expect(input.getAttribute('type')).toBe('checkbox')
    expect(input.getAttribute('role')).toBe('switch')
  })

  it('uncontrolled toggles internal state', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisSwitch, { props: { defaultChecked: true, onChange } })
    const input = container.querySelector('input')! as HTMLInputElement
    expect(input.checked).toBe(true)
    await fireEvent.click(input)
    flushSync()
    expect(onChange).toHaveBeenCalledWith(false, expect.anything())
    expect(input.checked).toBe(false)
  })

  it('controlled honors prop, ignores own state', async () => {
    const { container, rerender } = render(IrisSwitch, { props: { checked: false } })
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(false)
    await rerender({ checked: true })
    flushSync()
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true)
  })

  it('disabled blocks change', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisSwitch, { props: { disabled: true, onChange } })
    await fireEvent.click(container.querySelector('input')!)
    flushSync()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('aria-checked reflects state', async () => {
    const { container, rerender } = render(IrisSwitch, { props: { checked: false } })
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('false')
    await rerender({ checked: true })
    flushSync()
    expect(container.querySelector('input')!.getAttribute('aria-checked')).toBe('true')
  })

  it('invalid → aria-invalid', () => {
    const { container } = render(IrisSwitch, { props: { invalid: true } })
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(IrisSwitch, { props: { ariaDescribedby: 'hint' } })
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('hint')
  })

  it('data-state reflects checked', async () => {
    const { container, rerender } = render(IrisSwitch, { props: { checked: false } })
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'unchecked',
    )
    await rerender({ checked: true })
    flushSync()
    expect(container.querySelector('[data-iris-switch]')!.getAttribute('data-state')).toBe(
      'checked',
    )
  })

  it('size flips data-iris-switch-size attr', () => {
    const { container } = render(IrisSwitch, { props: { size: 'lg' } })
    expect(
      container.querySelector('[data-iris-switch]')!.getAttribute('data-iris-switch-size'),
    ).toBe('lg')
  })
})
