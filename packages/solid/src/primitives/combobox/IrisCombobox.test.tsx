import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisCombobox } from './IrisCombobox'

afterEach(cleanup)

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

describe('IrisCombobox', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    expect(container.querySelector('[data-iris-combobox-input]')).not.toBeNull()
  })

  it('shows all options on focus', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = container.querySelector('[data-iris-combobox-input]')!
    fireEvent.focus(input)
    expect(container.querySelectorAll('[data-iris-combobox-option]').length).toBe(3)
  })

  it('filters options on input', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = container.querySelector('[data-iris-combobox-input]') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.input(input, { target: { value: 'ban' } })
    expect(container.querySelectorAll('[data-iris-combobox-option]').length).toBe(1)
    expect(container.querySelector('[data-iris-combobox-option]')?.textContent).toBe('Banana')
  })

  it('calls onChange when an option is clicked', () => {
    const onChange = vi.fn()
    const { container, getByText } = render(() => (
      <IrisCombobox options={options} onChange={onChange} />
    ))
    fireEvent.focus(container.querySelector('[data-iris-combobox-input]')!)
    fireEvent.click(getByText('Cherry'))
    expect(onChange).toHaveBeenCalledWith('cherry')
  })
})
