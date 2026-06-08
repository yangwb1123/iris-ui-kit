import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisOtpInput from './IrisOtpInput.svelte'

describe('IrisOtpInput', () => {
  it('renders N cells based on length', () => {
    const { container } = render(IrisOtpInput, { props: { length: 4 } })
    expect(container.querySelectorAll('[data-iris-otp-input-cell]').length).toBe(4)
  })

  it('defaults to 6 cells', () => {
    const { container } = render(IrisOtpInput)
    expect(container.querySelectorAll('[data-iris-otp-input-cell]').length).toBe(6)
  })

  it('sets role=group on root', () => {
    const { container } = render(IrisOtpInput)
    expect(container.querySelector('[role="group"]')).not.toBeNull()
  })

  it('marks as invalid', () => {
    const { container } = render(IrisOtpInput, { props: { invalid: true } })
    expect(container.querySelector('[data-state="invalid"]')).not.toBeNull()
  })
})
