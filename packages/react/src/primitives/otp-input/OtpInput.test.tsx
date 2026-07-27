import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisOtpInput } from './OtpInput'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisOtpInput', () => {
  it('renders `length` cells (default 6)', () => {
    const { container } = render(<IrisOtpInput />)
    expect(container.querySelectorAll('[data-iris-otp-input-cell]').length).toBe(6)
  })

  it('honors a custom length', () => {
    const { container } = render(<IrisOtpInput length={4} />)
    expect(container.querySelectorAll('input').length).toBe(4)
  })

  it('typing a digit emits the value and advances focus', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisOtpInput length={4} onValueChange={onValueChange} />)
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(onValueChange).toHaveBeenLastCalledWith('1')
    expect(document.activeElement).toBe(inputs[1])
  })

  it('numeric type rejects letters', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisOtpInput length={4} onValueChange={onValueChange} />)
    fireEvent.change(container.querySelector('input')!, { target: { value: 'a' } })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('alphanumeric type accepts letters', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisOtpInput length={4} type="alphanumeric" onValueChange={onValueChange} />,
    )
    fireEvent.change(container.querySelector('input')!, { target: { value: 'a' } })
    expect(onValueChange).toHaveBeenLastCalledWith('a')
  })

  it('fires onComplete when the final cell fills', () => {
    const onComplete = vi.fn()
    const { container } = render(
      <IrisOtpInput length={3} defaultValue="12" onComplete={onComplete} />,
    )
    fireEvent.change(container.querySelectorAll('input')[2], { target: { value: '3' } })
    expect(onComplete).toHaveBeenCalledWith('123')
  })

  it('Backspace clears the current cell and moves back', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisOtpInput length={4} defaultValue="12" onValueChange={onValueChange} />,
    )
    const inputs = container.querySelectorAll('input')
    inputs[1].focus()
    fireEvent.keyDown(inputs[1], { key: 'Backspace' })
    expect(onValueChange).toHaveBeenLastCalledWith('1')
    expect(document.activeElement).toBe(inputs[0])
  })

  it('Backspace on an empty cell removes the previous char', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisOtpInput length={4} defaultValue="12" onValueChange={onValueChange} />,
    )
    const inputs = container.querySelectorAll('input')
    inputs[2].focus()
    fireEvent.keyDown(inputs[2], { key: 'Backspace' })
    expect(onValueChange).toHaveBeenLastCalledWith('1')
  })

  it('ArrowRight / ArrowLeft move focus', () => {
    const { container } = render(<IrisOtpInput length={4} />)
    const inputs = container.querySelectorAll('input')
    inputs[0].focus()
    fireEvent.keyDown(inputs[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(inputs[1])
    fireEvent.keyDown(inputs[1], { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(inputs[0])
  })

  it('paste distributes across cells from the focused one', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisOtpInput length={6} onValueChange={onValueChange} />)
    fireEvent.paste(container.querySelector('input')!, {
      clipboardData: { getData: () => '123456' },
    })
    expect(onValueChange).toHaveBeenLastCalledWith('123456')
  })

  it('paste sanitizes to allowed characters and caps at length', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisOtpInput length={4} onValueChange={onValueChange} />)
    fireEvent.paste(container.querySelector('input')!, {
      clipboardData: { getData: () => '1a2b3c4d5e' },
    })
    expect(onValueChange).toHaveBeenLastCalledWith('1234')
  })

  it('mask renders password cells', () => {
    const { container } = render(<IrisOtpInput mask />)
    expect(container.querySelector('input')!.getAttribute('type')).toBe('password')
  })

  it('a11y: role=group, per-cell aria-label, id on first cell, aria-invalid', () => {
    const { container } = render(<IrisOtpInput length={3} id="code" invalid />)
    expect(container.querySelector('[role="group"]')).not.toBeNull()
    const inputs = container.querySelectorAll('input')
    expect(inputs[0].getAttribute('aria-label')).toBe('Character 1 of 3')
    expect(inputs[0].id).toBe('code')
    expect(inputs[0].getAttribute('aria-invalid')).toBe('true')
  })
})
