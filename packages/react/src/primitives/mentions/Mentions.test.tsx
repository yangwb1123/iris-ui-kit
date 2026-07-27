import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisMentions, type IrisMentionOption } from './Mentions'

afterEach(() => cleanup())

const OPTS: IrisMentionOption[] = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
]

const options = (c: HTMLElement) => c.querySelectorAll('[data-iris-mentions-option]')

describe('@iris-ui-kit/react IrisMentions', () => {
  it('opens filtered suggestions when typing the trigger', () => {
    const { container } = render(<IrisMentions options={OPTS} />)
    fireEvent.change(container.querySelector('textarea')!, {
      target: { value: 'Hi @a', selectionStart: 5 },
    })
    expect(options(container).length).toBe(1)
    expect(options(container)[0].textContent).toBe('Alice')
  })

  it('shows no listbox without an active trigger', () => {
    const { container } = render(<IrisMentions options={OPTS} />)
    fireEvent.change(container.querySelector('textarea')!, {
      target: { value: 'plain text', selectionStart: 10 },
    })
    expect(container.querySelector('[data-iris-mentions-listbox]')).toBeNull()
  })

  it('inserts the selected mention into the text', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisMentions options={OPTS} onValueChange={onValueChange} />)
    fireEvent.change(container.querySelector('textarea')!, {
      target: { value: 'Hi @a', selectionStart: 5 },
    })
    fireEvent.click(options(container)[0])
    expect(onValueChange).toHaveBeenLastCalledWith('Hi @Alice ')
  })

  it('Escape dismisses the listbox', () => {
    const { container } = render(<IrisMentions options={OPTS} />)
    const ta = container.querySelector('textarea')!
    fireEvent.change(ta, { target: { value: '@', selectionStart: 1 } })
    expect(container.querySelector('[data-iris-mentions-listbox]')).not.toBeNull()
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect(container.querySelector('[data-iris-mentions-listbox]')).toBeNull()
  })

  it('ArrowDown + Enter selects the active suggestion', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisMentions options={OPTS} onValueChange={onValueChange} />)
    const ta = container.querySelector('textarea')!
    fireEvent.change(ta, { target: { value: '@', selectionStart: 1 } })
    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onValueChange).toHaveBeenLastCalledWith('@Bob ')
  })

  it('a11y: combobox textarea wired to the listbox', () => {
    const { container } = render(<IrisMentions options={OPTS} />)
    const ta = container.querySelector('textarea')!
    expect(ta.getAttribute('role')).toBe('combobox')
    fireEvent.change(ta, { target: { value: '@', selectionStart: 1 } })
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement
    expect(ta.getAttribute('aria-controls')).toBe(listbox.id)
    expect(ta.getAttribute('aria-expanded')).toBe('true')
  })

  it('disabled textarea has aria-disabled attribute', () => {
    const { container } = render(<IrisMentions options={OPTS} disabled />)
    const ta = container.querySelector('textarea')!
    expect(ta.hasAttribute('disabled')).toBe(true)
  })

  it('custom prefix opens suggestions', () => {
    const { container } = render(<IrisMentions options={OPTS} prefix="#" />)
    fireEvent.change(container.querySelector('textarea')!, {
      target: { value: 'use #A', selectionStart: 6 },
    })
    expect(container.querySelector('[data-iris-mentions-listbox]')).not.toBeNull()
  })

  it('empty state: no matching options shows no listbox', () => {
    const { container } = render(<IrisMentions options={OPTS} />)
    fireEvent.change(container.querySelector('textarea')!, {
      target: { value: '@zzz', selectionStart: 5 },
    })
    expect(container.querySelector('[data-iris-mentions-listbox]')).toBeNull()
  })

  it('controlled value prop works', () => {
    const { container, rerender } = render(<IrisMentions options={OPTS} value="hello" />)
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('hello')
    rerender(<IrisMentions options={OPTS} value="world" />)
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('world')
  })
})
