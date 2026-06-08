import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisOtpInput } from './IrisOtpInput'

afterEach(cleanup)

describe('IrisOtpInput', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisOtpInput />)
    expect(container.querySelector('[data-iris-otp-input]')).not.toBeNull()
  })

  it('renders correct number of cells', () => {
    const { container } = render(() => <IrisOtpInput length={4} />)
    const cells = container.querySelectorAll('[data-iris-otp-input-cell]')
    expect(cells.length).toBe(4)
  })

  it('calls onComplete when all cells are filled', () => {
    const onComplete = vi.fn()
    const { container } = render(() => <IrisOtpInput length={3} onComplete={onComplete} />)
    const cells = container.querySelectorAll('input')
    fireEvent.input(cells[0], { target: { value: '1' } })
    fireEvent.input(cells[1], { target: { value: '2' } })
    fireEvent.input(cells[2], { target: { value: '3' } })
    expect(onComplete).toHaveBeenCalledWith('123')
  })
})
