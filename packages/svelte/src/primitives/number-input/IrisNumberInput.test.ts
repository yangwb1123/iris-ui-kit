import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisNumberInput from './IrisNumberInput.svelte'

describe('IrisNumberInput', () => {
  it('renders increment and decrement buttons', () => {
    const { container } = render(IrisNumberInput)
    expect(container.querySelector('[data-iris-number-input-inc]')).not.toBeNull()
    expect(container.querySelector('[data-iris-number-input-dec]')).not.toBeNull()
  })

  it('hides controls when showControls=false', () => {
    const { container } = render(IrisNumberInput, { props: { showControls: false } })
    expect(container.querySelector('[data-iris-number-input-inc]')).toBeNull()
  })

  it('calls onchange when increment clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisNumberInput, { props: { value: 5, step: 1, onchange } })
    const inc = container.querySelector('[data-iris-number-input-inc]') as HTMLButtonElement
    await fireEvent.click(inc)
    flushSync()
    expect(onchange).toHaveBeenCalledWith(6)
  })

  it('disables at min', () => {
    const { container } = render(IrisNumberInput, { props: { value: 0, min: 0 } })
    const dec = container.querySelector('[data-iris-number-input-dec]') as HTMLButtonElement
    expect(dec.disabled).toBe(true)
  })
})
