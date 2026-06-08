import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
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
})
