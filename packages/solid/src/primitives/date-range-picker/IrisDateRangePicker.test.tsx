import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisDateRangePicker } from './IrisDateRangePicker'

afterEach(cleanup)

describe('IrisDateRangePicker', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    expect(container.querySelector('[data-iris-date-range-picker]')).not.toBeNull()
  })

  it('shows start and end buttons', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    expect(container.querySelector('[data-iris-date-range-picker-start]')).not.toBeNull()
    expect(container.querySelector('[data-iris-date-range-picker-end]')).not.toBeNull()
  })

  it('opens panel when start is clicked', () => {
    const { container } = render(() => <IrisDateRangePicker />)
    expect(container.querySelector('[data-iris-date-range-picker-panel]')).toBeNull()
    const startBtn = container.querySelector(
      '[data-iris-date-range-picker-start]',
    ) as HTMLButtonElement
    fireEvent.click(startBtn)
    expect(container.querySelector('[data-iris-date-range-picker-panel]')).not.toBeNull()
  })
})
