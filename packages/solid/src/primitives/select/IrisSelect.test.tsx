import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisSelect } from './IrisSelect'

afterEach(cleanup)

const items = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

describe('IrisSelect', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisSelect items={items} />)
    expect(container.querySelector('[data-iris-select-trigger]')).not.toBeNull()
  })

  it('shows placeholder when no value selected', () => {
    const { getByText } = render(() => <IrisSelect items={items} placeholder="Choose fruit" />)
    expect(getByText('Choose fruit')).toBeTruthy()
  })

  it('opens listbox on click', () => {
    const { container } = render(() => <IrisSelect items={items} portalTarget={false} />)
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    expect(container.querySelector('[data-iris-select-listbox]')).toBeNull()
    fireEvent.click(trigger)
    expect(container.querySelector('[data-iris-select-listbox]')).not.toBeNull()
  })

  it('calls onChange when an item is selected', () => {
    const onChange = vi.fn()
    const { container, getByText } = render(() => (
      <IrisSelect items={items} onChange={onChange} portalTarget={false} />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    fireEvent.click(getByText('Banana'))
    expect(onChange).toHaveBeenCalledWith('banana')
  })

  it('shows selected label in trigger', () => {
    const { container } = render(() => <IrisSelect items={items} value="cherry" />)
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent).toContain('Cherry')
  })
})
