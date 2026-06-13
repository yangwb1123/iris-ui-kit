import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisMentions } from './IrisMentions'

afterEach(cleanup)

const options = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
]

describe('IrisMentions', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisMentions options={options} />)
    expect(container.querySelector('[data-iris-mentions]')).not.toBeNull()
  })

  it('renders textarea', () => {
    const { container } = render(() => <IrisMentions />)
    expect(container.querySelector('[data-iris-mentions-textarea]')).not.toBeNull()
  })

  it('calls onChange on input', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisMentions onChange={onChange} />)
    const ta = container.querySelector('[data-iris-mentions-textarea]') as HTMLTextAreaElement
    fireEvent.input(ta, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('exposes combobox ARIA wiring on the textarea', () => {
    const { container } = render(() => <IrisMentions options={options} />)
    const ta = container.querySelector('[data-iris-mentions-textarea]') as HTMLTextAreaElement
    expect(ta.getAttribute('role')).toBe('combobox')
    expect(ta.getAttribute('aria-autocomplete')).toBe('list')
    expect(ta.getAttribute('aria-expanded')).toBe('false')
    expect(ta.getAttribute('aria-controls')).toBeTruthy()
  })
})
