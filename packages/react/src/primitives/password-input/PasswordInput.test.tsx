import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisPasswordInput } from './PasswordInput'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisPasswordInput', () => {
  it('renders type=password by default', () => {
    const { container } = render(<IrisPasswordInput />)
    expect(container.querySelector('input')!.getAttribute('type')).toBe('password')
  })

  it('renders the toggle button by default', () => {
    const { container } = render(<IrisPasswordInput />)
    expect(container.querySelector('[data-iris-password-input-toggle]')).not.toBeNull()
  })

  it('showToggle=false hides the toggle', () => {
    const { container } = render(<IrisPasswordInput showToggle={false} />)
    expect(container.querySelector('[data-iris-password-input-toggle]')).toBeNull()
  })

  it('clicking toggle flips type', () => {
    const { container } = render(<IrisPasswordInput />)
    const btn = container.querySelector('[data-iris-password-input-toggle]')!
    fireEvent.click(btn)
    expect(container.querySelector('input')!.getAttribute('type')).toBe('text')
    fireEvent.click(btn)
    expect(container.querySelector('input')!.getAttribute('type')).toBe('password')
  })

  it('aria-pressed reflects visibility', () => {
    const { container } = render(<IrisPasswordInput />)
    const btn = container.querySelector('[data-iris-password-input-toggle]')!
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('disabled blocks toggle', () => {
    const { container } = render(<IrisPasswordInput disabled />)
    const btn = container.querySelector('[data-iris-password-input-toggle]')!
    fireEvent.click(btn)
    expect(container.querySelector('input')!.getAttribute('type')).toBe('password')
  })
})
