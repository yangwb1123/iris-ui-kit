import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisDatePicker from './IrisDatePicker.svelte'

describe('IrisDatePicker', () => {
  it('renders a trigger button', () => {
    const { container } = render(IrisDatePicker)
    expect(container.querySelector('[data-iris-date-picker-trigger]')).toBeTruthy()
  })

  it('opens calendar on trigger click', async () => {
    const { container } = render(IrisDatePicker)
    const trigger = container.querySelector('[data-iris-date-picker-trigger]')!
    await fireEvent.click(trigger)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeTruthy()
  })

  it('shows placeholder when no value', () => {
    const { container } = render(IrisDatePicker, { props: { placeholder: 'Pick a date' } })
    const trigger = container.querySelector('[data-iris-date-picker-trigger]')!
    expect(trigger.textContent).toContain('Pick a date')
  })
})
