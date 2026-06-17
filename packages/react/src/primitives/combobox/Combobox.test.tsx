import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCombobox, type IrisComboboxOption } from './Combobox'

afterEach(() => cleanup())

const OPTIONS: IrisComboboxOption[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

const input = (c: HTMLElement) => c.querySelector('[data-iris-combobox-input]') as HTMLInputElement
const opts = (c: HTMLElement) => c.querySelectorAll('[data-iris-combobox-option]')

describe('@iris-ui/react IrisCombobox', () => {
  it('renders a combobox input, closed initially', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    const el = input(container)
    expect(el.getAttribute('role')).toBe('combobox')
    expect(el.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on focus and lists all options', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    expect(input(container).getAttribute('aria-expanded')).toBe('true')
    expect(opts(container).length).toBe(3)
  })

  it('filters options as you type', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    fireEvent.change(input(container), { target: { value: 'Ba' } })
    expect(opts(container).length).toBe(1)
    expect(opts(container)[0].textContent).toBe('Banana')
  })

  it('clicking an option selects it and shows its label', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisCombobox options={OPTIONS} onValueChange={onValueChange} />)
    fireEvent.focus(input(container))
    fireEvent.click(opts(container)[1])
    expect(onValueChange).toHaveBeenCalledWith('banana')
    expect(input(container).value).toBe('Banana')
  })

  it('keyboard: ArrowDown + Enter selects the active option', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisCombobox options={OPTIONS} onValueChange={onValueChange} />)
    const el = input(container)
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith('banana')
  })

  it('Escape closes the listbox', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    expect(input(container).getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(input(container), { key: 'Escape' })
    expect(input(container).getAttribute('aria-expanded')).toBe('false')
  })

  it('shows empty text when nothing matches', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    fireEvent.change(input(container), { target: { value: 'zzz' } })
    expect(opts(container).length).toBe(0)
    expect(container.querySelector('[data-iris-combobox-empty]')!.textContent).toBe('No results')
  })

  it('reflects the selected value as the input text (controlled)', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} value="cherry" />)
    expect(input(container).value).toBe('Cherry')
  })

  it('marks the selected option with aria-selected', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} value="banana" />)
    fireEvent.focus(input(container))
    const selected = Array.from(opts(container)).find(
      (o) => o.getAttribute('aria-selected') === 'true',
    )
    expect(selected?.textContent).toBe('Banana')
  })

  it('disabled does not open', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} disabled />)
    fireEvent.focus(input(container))
    expect(input(container).getAttribute('aria-expanded')).toBe('false')
  })

  it('a11y: aria-controls points at the listbox; activedescendant tracks the active option', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} id="cb" />)
    const el = input(container)
    expect(el.id).toBe('cb')
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement
    expect(listbox.id).toBe(el.getAttribute('aria-controls'))
    expect(el.getAttribute('aria-activedescendant')).toBeTruthy()
  })
})
