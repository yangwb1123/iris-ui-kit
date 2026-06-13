import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisDatePicker } from './IrisDatePicker'

afterEach(cleanup)

describe('IrisDatePicker', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisDatePicker />)
    expect(container.querySelector('[data-iris-date-picker]')).not.toBeNull()
  })

  it('opens calendar panel on trigger click', () => {
    const { container } = render(() => <IrisDatePicker />)
    const trigger = container.querySelector('[data-iris-date-picker-trigger]') as HTMLButtonElement
    expect(container.querySelector('[data-iris-date-picker-panel]')).toBeNull()
    fireEvent.click(trigger)
    expect(container.querySelector('[data-iris-date-picker-panel]')).not.toBeNull()
  })

  it('trigger exposes aria-haspopup/aria-expanded; panel is role=dialog', () => {
    const { container } = render(() => <IrisDatePicker />)
    const trigger = container.querySelector('[data-iris-date-picker-trigger]') as HTMLButtonElement
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-iris-date-picker-panel]')!.getAttribute('role')).toBe(
      'dialog',
    )
  })

  it('shows placeholder when no value', () => {
    const { getByText } = render(() => <IrisDatePicker placeholder="Pick a date" />)
    expect(getByText('Pick a date')).not.toBeNull()
  })
})
