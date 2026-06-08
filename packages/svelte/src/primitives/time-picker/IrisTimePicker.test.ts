import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisTimePicker from './IrisTimePicker.svelte'

describe('IrisTimePicker', () => {
  it('renders hours and minutes columns', () => {
    const { container } = render(IrisTimePicker)
    expect(container.querySelector('[data-iris-time-picker-hours]')).toBeTruthy()
    expect(container.querySelector('[data-iris-time-picker-minutes]')).toBeTruthy()
  })

  it('does not render seconds column by default', () => {
    const { container } = render(IrisTimePicker)
    expect(container.querySelector('[data-iris-time-picker-seconds]')).toBeFalsy()
  })

  it('renders seconds when showSeconds=true', () => {
    const { container } = render(IrisTimePicker, { props: { showSeconds: true } })
    expect(container.querySelector('[data-iris-time-picker-seconds]')).toBeTruthy()
  })

  it('calls onValueChange when hour selected', async () => {
    let changed: unknown = null
    const { container } = render(IrisTimePicker, {
      props: {
        value: { hour: 0, minute: 0, second: 0 },
        onValueChange: (v: unknown) => {
          changed = v
        },
      },
    })
    const hourBtns = container.querySelectorAll('[data-iris-time-picker-hours] button')
    await fireEvent.click(hourBtns[5]!)
    flushSync()
    expect(changed).toBeTruthy()
  })
})
