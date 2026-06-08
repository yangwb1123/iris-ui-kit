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

  it('shows placeholder when no value', () => {
    const { getByText } = render(() => <IrisDatePicker placeholder="Pick a date" />)
    expect(getByText('Pick a date')).not.toBeNull()
  })
})
