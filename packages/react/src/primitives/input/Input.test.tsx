import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisInput } from './Input'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisInput', () => {
  it('renders a native <input>', () => {
    const { container } = render(<IrisInput placeholder="x" />)
    expect(container.querySelector('input')).not.toBeNull()
  })

  it('value + onChange (controlled)', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisInput value="hello" onChange={onChange} />)
    const input = container.querySelector('input')!
    expect(input.value).toBe('hello')
    fireEvent.change(input, { target: { value: 'world' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('disabled forwarded + style opacity drops', () => {
    const { container } = render(<IrisInput disabled />)
    expect(container.querySelector('input')!.disabled).toBe(true)
    const label = container.querySelector('[data-iris-input]') as HTMLElement
    expect(label.getAttribute('style')).toContain('opacity: 0.6')
  })

  it('invalid sets aria-invalid + data-state="invalid"', () => {
    const { container } = render(<IrisInput invalid />)
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-state')).toBe('invalid')
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(<IrisInput ariaDescribedby="hint-id" />)
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('hint-id')
  })

  it('focus → data-state="focused"; blur → idle', () => {
    const { container } = render(<IrisInput />)
    const input = container.querySelector('input')!
    fireEvent.focus(input)
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-state')).toBe('focused')
    fireEvent.blur(input)
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-state')).toBe('idle')
  })

  it('renders prefix + suffix', () => {
    const { container } = render(<IrisInput prefix={<span>$</span>} suffix={<span>USD</span>} />)
    expect(container.querySelector('[data-iris-input-prefix]')!.textContent).toBe('$')
    expect(container.querySelector('[data-iris-input-suffix]')!.textContent).toBe('USD')
  })

  it('size sm/md/lg flips data attr + font size', () => {
    const { container, rerender } = render(<IrisInput size="sm" />)
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-iris-input-size')).toBe(
      'sm',
    )
    rerender(<IrisInput size="lg" />)
    expect(container.querySelector('[data-iris-input]')!.getAttribute('style')).toContain(
      'font-size: var(--iris-font-size-lg, 16px)',
    )
  })

  it('type prop is honored', () => {
    const { container } = render(<IrisInput type="password" />)
    expect(container.querySelector('input')!.getAttribute('type')).toBe('password')
  })

  it('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<IrisInput ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})

import * as React from 'react'
