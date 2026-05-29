import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisNumberInput } from './NumberInput'

afterEach(() => cleanup())

describe('@iris-ui/react IrisNumberInput', () => {
  it('renders input + +/- buttons', () => {
    const { container } = render(<IrisNumberInput />)
    expect(container.querySelector('input')).not.toBeNull()
    expect(container.querySelector('[data-iris-number-input-inc]')).not.toBeNull()
    expect(container.querySelector('[data-iris-number-input-dec]')).not.toBeNull()
  })

  it('showControls=false hides +/-', () => {
    const { container } = render(<IrisNumberInput showControls={false} />)
    expect(container.querySelector('[data-iris-number-input-inc]')).toBeNull()
  })

  it('increment emits next value', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={5} onChange={onChange} />)
    fireEvent.click(container.querySelector('[data-iris-number-input-inc]')!)
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  it('decrement emits next value', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={5} onChange={onChange} />)
    fireEvent.click(container.querySelector('[data-iris-number-input-dec]')!)
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('ArrowUp / ArrowDown move by step', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={10} onChange={onChange} />)
    fireEvent.keyDown(container.querySelector('input')!, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(11)
    fireEvent.keyDown(container.querySelector('input')!, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  it('decimal step (0.2 + 0.1) rounds to 0.3', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={0.2} step={0.1} onChange={onChange} />)
    fireEvent.click(container.querySelector('[data-iris-number-input-inc]')!)
    expect(onChange).toHaveBeenLastCalledWith(0.3)
  })

  it('empty input emits null', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={5} onChange={onChange} />)
    fireEvent.change(container.querySelector('input')!, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('non-numeric input emits null', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={5} onChange={onChange} />)
    fireEvent.change(container.querySelector('input')!, { target: { value: 'abc' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('starts from min when value is null and user clicks +', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisNumberInput value={null} min={3} onChange={onChange} />)
    fireEvent.click(container.querySelector('[data-iris-number-input-inc]')!)
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('+/- buttons disabled at min/max', () => {
    const { container, rerender } = render(<IrisNumberInput value={0} min={0} />)
    expect(container.querySelector('[data-iris-number-input-dec]')!.hasAttribute('disabled')).toBe(
      true,
    )
    rerender(<IrisNumberInput value={100} max={100} />)
    expect(container.querySelector('[data-iris-number-input-inc]')!.hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('role="spinbutton" + aria-valuemin/max/now', () => {
    const { container } = render(<IrisNumberInput value={7} min={0} max={10} />)
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('spinbutton')
    expect(input.getAttribute('aria-valuenow')).toBe('7')
    expect(input.getAttribute('aria-valuemin')).toBe('0')
    expect(input.getAttribute('aria-valuemax')).toBe('10')
  })
})
