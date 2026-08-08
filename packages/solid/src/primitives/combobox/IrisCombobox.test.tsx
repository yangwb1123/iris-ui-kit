import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisCombobox } from './IrisCombobox'

afterEach(cleanup)

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

function inputEl(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-combobox-input]') as HTMLInputElement
}
function listEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-combobox-listbox]')
}
function optionEls(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-combobox-option]'))
}
function spacerEls(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-combobox-spacer]'))
}
function makeOptions(n: number): { label: string; value: string }[] {
  return Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))
}

describe('IrisCombobox', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    expect(inputEl(container)).not.toBeNull()
  })

  it('shows aria attributes on the input', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = inputEl(container)
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
  })

  it('opens the listbox on focus and sets aria-expanded', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = inputEl(container)
    fireEvent.focus(input)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(listEl(container)).not.toBeNull()
    expect(optionEls(container).length).toBe(3)
  })

  it('shows all options on focus', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = inputEl(container)
    fireEvent.focus(input)
    expect(optionEls(container).length).toBe(3)
  })

  it('filters options on input', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = inputEl(container)
    fireEvent.focus(input)
    fireEvent.input(input, { target: { value: 'ban' } })
    const visible = optionEls(container)
    expect(visible.length).toBe(1)
    expect(visible[0]?.textContent).toBe('Banana')
  })

  it('resets filter when no query entered on focus', () => {
    const { container } = render(() => <IrisCombobox options={options} />)
    const input = inputEl(container)
    fireEvent.focus(input)
    fireEvent.input(input, { target: { value: 'ban' } })
    expect(optionEls(container).length).toBe(1)
    // Clear filter by removing query and re-focusing
    fireEvent.input(input, { target: { value: '' } })
    // After clearing, it shows all options again
    expect(optionEls(container).length).toBe(3)
  })

  it('calls onChange when an option is clicked', () => {
    const onChange = vi.fn()
    const { container, getByText } = render(() => (
      <IrisCombobox options={options} onChange={onChange} />
    ))
    fireEvent.focus(inputEl(container))
    fireEvent.click(getByText('Cherry'))
    expect(onChange).toHaveBeenCalledWith('cherry')
  })

  describe('keyboard navigation', () => {
    it('opens listbox on ArrowDown', () => {
      const { container } = render(() => <IrisCombobox options={options} onChange={vi.fn()} />)
      const input = inputEl(container)
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(listEl(container)).not.toBeNull()
      expect(input.getAttribute('aria-expanded')).toBe('true')
    })

    it('selects active option on Enter', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisCombobox options={options} onChange={onChange} />)
      const input = inputEl(container)
      fireEvent.keyDown(input, { key: 'ArrowDown' }) // opens and selects first
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('apple')
    })

    it('closes listbox on Escape', () => {
      const { container } = render(() => <IrisCombobox options={options} />)
      const input = inputEl(container)
      fireEvent.focus(input)
      expect(input.getAttribute('aria-expanded')).toBe('true')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(input.getAttribute('aria-expanded')).toBe('false')
    })

    it('navigates with ArrowDown/ArrowUp and sets aria-activedescendant', () => {
      const { container } = render(() => <IrisCombobox options={options} />)
      const input = inputEl(container)
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-1$/)

      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    })

    it('Home jumps to first option, End to last', () => {
      const { container } = render(() => <IrisCombobox options={options} />)
      const input = inputEl(container)
      fireEvent.focus(input)
      fireEvent.keyDown(input, { key: 'End' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-2$/)
      fireEvent.keyDown(input, { key: 'Home' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    })
  })

  describe('states', () => {
    it('displays selected value in controlled mode', () => {
      const { container } = render(() => <IrisCombobox options={options} value="banana" />)
      const input = inputEl(container)
      expect(input.value).toBe('Banana')
    })

    it('disables the input when disabled', () => {
      const { container } = render(() => <IrisCombobox options={options} disabled />)
      const input = inputEl(container)
      expect(input.disabled).toBe(true)
    })

    it('applies aria-invalid when invalid', () => {
      const { container } = render(() => <IrisCombobox options={options} invalid />)
      const input = inputEl(container)
      expect(input.getAttribute('aria-invalid')).toBe('true')
    })

    it('shows empty text when no match', () => {
      const { container } = render(() => <IrisCombobox options={options} emptyText="No results" />)
      const input = inputEl(container)
      fireEvent.focus(input)
      fireEvent.input(input, { target: { value: 'zebra' } })
      // Empty state — no option elements
      expect(optionEls(container).length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty options array', () => {
      const { container } = render(() => <IrisCombobox options={[]} />)
      const input = inputEl(container)
      fireEvent.focus(input)
      // No crash with empty options
      expect(input.getAttribute('aria-expanded')).toBe('true')
    })

    it('does not call onChange when Enter pressed and no active option', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisCombobox options={options} onChange={onChange} />)
      const input = inputEl(container)
      // Enter without opening should not change
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('closes and does not select disabled option on click', () => {
      const opts = [
        { value: 'apple', label: 'Apple' },
        { value: 'disabled-opt', label: 'Disabled', disabled: true },
      ]
      const onChange = vi.fn()
      const { container } = render(() => <IrisCombobox options={opts} onChange={onChange} />)
      const input = inputEl(container)
      fireEvent.focus(input)
      const items = optionEls(container)
      const disabledItem = items.find((el) => el.getAttribute('aria-disabled') === 'true')
      expect(disabledItem).not.toBeUndefined()
      if (disabledItem) fireEvent.click(disabledItem)
      // Disabled option should not trigger onChange
      expect(onChange).not.toHaveBeenCalled()
    })
    describe('virtual listbox', () => {
      it('A1: virtual off (default) — all options, no spacers', () => {
        const { container } = render(() => <IrisCombobox options={options} />)
        fireEvent.focus(inputEl(container))
        expect(optionEls(container).length).toBe(3)
        expect(spacerEls(container).length).toBe(0)
      })

      it('A1: small list with virtual — total window, spacer sum invariant', () => {
        const { container } = render(() => <IrisCombobox options={options} virtual />)
        fireEvent.focus(inputEl(container))
        expect(optionEls(container).length).toBe(3)
        const sp = spacerEls(container)
        expect(sp.length).toBe(2)
        expect(sp[0]!.getAttribute('data-iris-combobox-spacer-type')).toBe('top')
        expect(sp[1]!.getAttribute('data-iris-combobox-spacer-type')).toBe('bottom')
        expect(
          parseFloat(sp[0]!.style.height) +
            optionEls(container).length * 34 +
            parseFloat(sp[1]!.style.height),
        ).toBe(3 * 34)
        expect(optionEls(container)[0]!.getAttribute('aria-setsize')).toBe('3')
        expect(optionEls(container)[0]!.getAttribute('aria-posinset')).toBe('1')
      })

      it('A2 smoke: 10k options — windowed render with spacer invariant', () => {
        const { container } = render(() => <IrisCombobox options={makeOptions(10_000)} virtual />)
        fireEvent.focus(inputEl(container))
        const rendered = optionEls(container)
        expect(rendered.length).toBeGreaterThanOrEqual(1)
        expect(rendered.length).toBeLessThanOrEqual(50)
        expect(rendered[0]!.id).toMatch(/-opt-0$/)
        const sp = spacerEls(container)
        expect(parseFloat(sp[0]!.style.height)).toBe(0)
        expect(
          parseFloat(sp[0]!.style.height) + rendered.length * 34 + parseFloat(sp[1]!.style.height),
        ).toBe(10_000 * 34)
      })

      it('A3 smoke: End scrolls the last option into view (maxScroll)', () => {
        const { container } = render(() => <IrisCombobox options={makeOptions(10_000)} virtual />)
        const input = inputEl(container)
        fireEvent.focus(input)
        fireEvent.keyDown(input, { key: 'End' })
        expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-9999$/)
        const lb = listEl(container) as HTMLElement
        expect(lb.scrollTop).toBe(339_760)
        const rendered = optionEls(container)
        expect(rendered.some((o) => o.id.endsWith('-opt-9999'))).toBe(true)
      })
    })
  })
})
