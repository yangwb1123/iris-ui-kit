import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisRadio from './IrisRadio.svelte'
import RadioHarness from './RadioHarness.svelte'

describe('IrisRadio', () => {
  it('renders radio group with options', () => {
    const { container } = render(RadioHarness)
    const radios = container.querySelectorAll('[data-iris-radio]')
    expect(radios.length).toBe(2)
  })

  it('calls onchange when a radio is selected', async () => {
    const onchange = vi.fn()
    const { container } = render(RadioHarness, { props: { onchange } })
    const inputs = container.querySelectorAll('input[type="radio"]')
    await fireEvent.click(inputs[0])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('a')
  })

  it('standalone uncontrolled radio checks itself and calls onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisRadio, { props: { value: 'a', onChange } })
    const input = container.querySelector<HTMLInputElement>('input[type="radio"]')!

    await fireEvent.click(input)
    flushSync()

    expect(container.querySelector('[data-iris-radio]')?.getAttribute('data-state')).toBe('checked')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-checked')).toBe('true')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('defaultChecked seeds a standalone radio', () => {
    const { container } = render(IrisRadio, { props: { value: 'a', defaultChecked: true } })
    const input = container.querySelector<HTMLInputElement>('input[type="radio"]')!

    expect(container.querySelector('[data-iris-radio]')?.getAttribute('data-state')).toBe('checked')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('aria-checked')).toBe('true')
  })

  it('controlled standalone radio only calls onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(IrisRadio, {
      props: { value: 'a', modelValue: 'b', onChange },
    })
    const input = container.querySelector<HTMLInputElement>('input[type="radio"]')!

    await fireEvent.click(input)
    flushSync()

    expect(onChange).toHaveBeenCalledWith(true)
    expect(container.querySelector('[data-iris-radio]')?.getAttribute('data-state')).toBe(
      'unchecked',
    )
    expect(input.checked).toBe(false)
    expect(input.getAttribute('aria-checked')).toBe('false')
  })

  it('group selection still updates the selected radio state', async () => {
    const { container } = render(RadioHarness)
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    await fireEvent.click(inputs[1])
    flushSync()
    expect(inputs[0].checked).toBe(false)
    expect(inputs[1].checked).toBe(true)

    const radios = container.querySelectorAll('[data-iris-radio]')
    expect(radios[0].getAttribute('data-state')).toBe('unchecked')
    expect(radios[1].getAttribute('data-state')).toBe('checked')
    expect(inputs[1].getAttribute('aria-checked')).toBe('true')
  })

  it('uncontrolled: defaultValue seeds the initial selection', () => {
    const { container } = render(RadioHarness, { props: { defaultValue: 'b' } })
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    expect(inputs[0].checked).toBe(false)
    expect(inputs[1].checked).toBe(true)
  })
})
