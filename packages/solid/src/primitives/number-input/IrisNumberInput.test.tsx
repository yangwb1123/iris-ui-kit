import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisNumberInput } from './IrisNumberInput'

afterEach(cleanup)

describe('IrisNumberInput', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisNumberInput />)
    expect(container.querySelector('[data-iris-number-input]')).not.toBeNull()
  })

  it('renders decrement and increment buttons by default', () => {
    const { container } = render(() => <IrisNumberInput />)
    expect(container.querySelector('[data-iris-number-input-dec]')).not.toBeNull()
    expect(container.querySelector('[data-iris-number-input-inc]')).not.toBeNull()
  })

  it('hides controls when showControls=false', () => {
    const { container } = render(() => <IrisNumberInput showControls={false} />)
    expect(container.querySelector('[data-iris-number-input-dec]')).toBeNull()
    expect(container.querySelector('[data-iris-number-input-inc]')).toBeNull()
  })

  it('calls onChange on increment button click', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisNumberInput defaultValue={5} onChange={onChange} />)
    const inc = container.querySelector('[data-iris-number-input-inc]') as HTMLButtonElement
    fireEvent.click(inc)
    expect(onChange).toHaveBeenCalledWith(6)
  })
})
