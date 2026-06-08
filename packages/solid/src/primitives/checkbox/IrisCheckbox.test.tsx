import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCheckbox } from './IrisCheckbox'

afterEach(cleanup)

describe('IrisCheckbox', () => {
  it('renders unchecked by default', () => {
    const { container } = render(() => <IrisCheckbox />)
    expect(container.querySelector('[data-state="unchecked"]')).not.toBeNull()
  })

  it('renders checked when checked=true', () => {
    const { container } = render(() => <IrisCheckbox checked={true} />)
    expect(container.querySelector('[data-state="checked"]')).not.toBeNull()
  })

  it('renders indeterminate state', () => {
    const { container } = render(() => <IrisCheckbox checked="indeterminate" />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-checked')).toBe('mixed')
    expect(container.querySelector('[data-state="indeterminate"]')).not.toBeNull()
  })

  it('calls onChange with next boolean on toggle (uncontrolled)', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisCheckbox onChange={onChange} />)
    const input = container.querySelector('input')!
    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('renders children label', () => {
    const { getByText } = render(() => <IrisCheckbox>Accept terms</IrisCheckbox>)
    expect(getByText('Accept terms')).toBeTruthy()
  })
})
