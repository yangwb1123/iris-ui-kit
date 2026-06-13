import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisTimePicker from './IrisTimePicker.svelte'

describe('IrisTimePicker', () => {
  it('renders hours and minutes number inputs', () => {
    const { container } = render(IrisTimePicker)
    expect(container.querySelector('[data-iris-time-picker-hours]')).toBeTruthy()
    expect(container.querySelector('[data-iris-time-picker-minutes]')).toBeTruthy()
  })

  it('does not render an AM/PM toggle in 24h format', () => {
    const { container } = render(IrisTimePicker)
    expect(container.querySelector('[data-iris-time-picker-meridiem]')).toBeFalsy()
  })

  it('renders the AM/PM toggle in 12h format', () => {
    const { container } = render(IrisTimePicker, { props: { format: '12h' } })
    expect(container.querySelector('[data-iris-time-picker-meridiem]')).toBeTruthy()
  })

  it('zero-pads the displayed hours/minutes from the value', () => {
    const { container } = render(IrisTimePicker, { props: { value: { hours: 9, minutes: 5 } } })
    const hours = container.querySelector('[data-iris-time-picker-hours]') as HTMLInputElement
    const minutes = container.querySelector('[data-iris-time-picker-minutes]') as HTMLInputElement
    expect(hours.value).toBe('09')
    expect(minutes.value).toBe('05')
  })

  it('emits { hours, minutes } when the hours input changes', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { value: { hours: 0, minutes: 0 }, onValueChange },
    })
    const hours = container.querySelector('[data-iris-time-picker-hours]') as HTMLInputElement
    await fireEvent.input(hours, { target: { value: '13' } })
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith({ hours: 13, minutes: 0 })
  })

  it('ArrowUp on the minutes input steps by minuteStep (uncontrolled)', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { minuteStep: 15, onValueChange },
    })
    const minutes = container.querySelector('[data-iris-time-picker-minutes]') as HTMLInputElement
    await fireEvent.keyDown(minutes, { key: 'ArrowUp' })
    flushSync()
    expect(onValueChange).toHaveBeenLastCalledWith({ hours: 0, minutes: 15 })
    // uncontrolled: the displayed value advanced too
    expect(minutes.value).toBe('15')
  })

  it('toggles AM/PM (12h) by flipping hours across the 12-hour boundary', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisTimePicker, {
      props: { format: '12h', value: { hours: 9, minutes: 0 }, onValueChange },
    })
    const toggle = container.querySelector('[data-iris-time-picker-meridiem]') as HTMLButtonElement
    expect(toggle.getAttribute('data-iris-time-picker-meridiem')).toBe('AM')
    await fireEvent.click(toggle)
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith({ hours: 21, minutes: 0 })
  })
})
