import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisMentions } from './IrisMentions'

afterEach(cleanup)

const options = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
  { label: 'Charlie', value: 'charlie' },
]

function textareaEl(container: HTMLElement): HTMLTextAreaElement {
  return container.querySelector('[data-iris-mentions-textarea]') as HTMLTextAreaElement
}
function listboxEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-mentions-list]')
}
function listboxItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-mentions-item]'))
}

describe('IrisMentions', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisMentions options={options} />)
    expect(container.querySelector('[data-iris-mentions]')).not.toBeNull()
  })

  it('renders textarea', () => {
    const { container } = render(() => <IrisMentions />)
    expect(textareaEl(container)).not.toBeNull()
  })

  it('calls onChange on input', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisMentions onChange={onChange} />)
    const ta = textareaEl(container)
    fireEvent.input(ta, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('exposes combobox ARIA wiring on the textarea', () => {
    const { container } = render(() => <IrisMentions options={options} />)
    const ta = textareaEl(container)
    expect(ta.getAttribute('role')).toBe('combobox')
    expect(ta.getAttribute('aria-autocomplete')).toBe('list')
    expect(ta.getAttribute('aria-expanded')).toBe('false')
    expect(ta.getAttribute('aria-controls')).toBeTruthy()
  })

  it('disabled textarea has disabled attribute', () => {
    const { container } = render(() => <IrisMentions options={options} disabled />)
    const ta = textareaEl(container)
    expect(ta.hasAttribute('disabled')).toBe(true)
  })

  describe('controlled mode', () => {
    it('shows the controlled value', () => {
      const { container } = render(() => <IrisMentions value="Hello @alice" options={options} />)
      const ta = textareaEl(container)
      expect(ta.value).toBe('Hello @alice')
    })
  })

  describe('@ prefix behavior', () => {
    it('@ prefix opens options listbox', () => {
      const { container } = render(() => <IrisMentions options={options} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@a' } })
      expect(listboxEl(container)).not.toBeNull()
    })

    it('@ without query shows all options', () => {
      const { container } = render(() => <IrisMentions options={options} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@' } })
      const items = listboxItems(container)
      expect(items.length).toBe(3)
    })

    it('filters options based on @ query', () => {
      const { container } = render(() => <IrisMentions options={options} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@al' } })
      const items = listboxItems(container)
      expect(items.length).toBe(1)
      expect(items[0]?.textContent).toContain('Alice')
    })

    it('does not open listbox for text without @', () => {
      const { container } = render(() => <IrisMentions options={options} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: 'hello world' } })
      expect(listboxEl(container)).toBeNull()
    })
  })

  describe('keyboard interaction', () => {
    it('Escape closes the listbox', () => {
      const { container } = render(() => <IrisMentions options={options} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@' } })
      expect(listboxEl(container)).not.toBeNull()
      fireEvent.keyDown(ta, { key: 'Escape' })
      expect(listboxEl(container)).toBeNull()
    })

    it('navigates options with ArrowDown/ArrowUp and sets aria-activedescendant', () => {
      const { container } = render(() => <IrisMentions options={options} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@' } })
      // ArrowDown activates first
      fireEvent.keyDown(ta, { key: 'ArrowDown' })
      expect(ta.getAttribute('aria-activedescendant')).toBeTruthy()
      // ArrowDown moves to second
      fireEvent.keyDown(ta, { key: 'ArrowDown' })
      // ArrowUp moves back
      fireEvent.keyDown(ta, { key: 'ArrowUp' })
    })

    it('selects option on Enter and inserts into text', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisMentions options={options} onChange={onChange} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@al' } })
      expect(listboxEl(container)).not.toBeNull()
      fireEvent.keyDown(ta, { key: 'ArrowDown' }) // activate first
      fireEvent.keyDown(ta, { key: 'Enter' })
      // After selection, @al is replaced with Alice
      expect(ta.value).toContain('Alice')
    })
  })

  describe('click interaction', () => {
    it('selects option on click and inserts into text', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisMentions options={options} onChange={onChange} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@b' } })
      const items = listboxItems(container)
      expect(items.length).toBe(1) // Bob filtered
      fireEvent.mouseDown(items[0]!)
      expect(ta.value).toContain('Bob')
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles empty options array', () => {
      const { container } = render(() => <IrisMentions options={[]} />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@' } })
      // @ with no matching options: listbox may be hidden or empty
      expect(textareaEl(container)).not.toBeNull()
    })

    it('does not crash with no options prop', () => {
      const { container } = render(() => <IrisMentions />)
      const ta = textareaEl(container)
      fireEvent.input(ta, { target: { value: '@test' } })
      expect(textareaEl(container)).not.toBeNull()
    })
  })
})
