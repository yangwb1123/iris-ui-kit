import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTimePicker } from './IrisTimePicker'

afterEach(cleanup)

describe('IrisTimePicker', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTimePicker />)
    expect(container.querySelector('[data-iris-time-picker]')).not.toBeNull()
  })

  it('renders hours and minutes inputs', () => {
    const { container } = render(() => <IrisTimePicker />)
    expect(container.querySelector('[data-iris-time-picker-hours]')).not.toBeNull()
    expect(container.querySelector('[data-iris-time-picker-minutes]')).not.toBeNull()
  })

  it('shows AM/PM toggle in 12h format', () => {
    const { container } = render(() => <IrisTimePicker format="12h" />)
    expect(container.querySelector('[data-iris-time-picker-meridiem]')).not.toBeNull()
  })

  it('calls onChange when hours change', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTimePicker onChange={onChange} />)
    const hoursInput = container.querySelector('[data-iris-time-picker-hours]') as HTMLInputElement
    fireEvent.input(hoursInput, { target: { value: '10' } })
    expect(onChange).toHaveBeenCalledOnce()
  })
})
