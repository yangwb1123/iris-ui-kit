import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisDateRangePicker from './IrisDateRangePicker.svelte'

describe('IrisDateRangePicker', () => {
  it('renders start and end triggers', () => {
    const { container } = render(IrisDateRangePicker)
    expect(container.querySelector('[data-iris-date-range-picker-start]')).toBeTruthy()
    expect(container.querySelector('[data-iris-date-range-picker-end]')).toBeTruthy()
  })

  it('opens calendar on start click', async () => {
    const { container } = render(IrisDateRangePicker)
    const start = container.querySelector('[data-iris-date-range-picker-start]')!
    await fireEvent.click(start)
    flushSync()
    expect(container.querySelector('[data-iris-calendar]')).toBeTruthy()
  })
})
