import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisMentions from './IrisMentions.svelte'

const options = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
]

describe('IrisMentions', () => {
  it('renders a textarea', () => {
    const { container } = render(IrisMentions, { props: { options } })
    expect(container.querySelector('[data-iris-mentions-textarea]')).toBeTruthy()
  })

  it('shows suggestion list on @ trigger', async () => {
    const { container } = render(IrisMentions, { props: { options, value: '' } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.value = '@'
    ta.setSelectionRange(1, 1)
    await fireEvent.input(ta)
    flushSync()
    expect(container.querySelector('[data-iris-mentions-list]')).toBeTruthy()
  })

  it('does not show list without @', () => {
    const { container } = render(IrisMentions, { props: { options, value: 'hello' } })
    expect(container.querySelector('[data-iris-mentions-list]')).toBeFalsy()
  })

  it('updates the textarea when uncontrolled (no value bound)', async () => {
    const { container } = render(IrisMentions, { props: { options } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    ta.value = 'hello world'
    await fireEvent.input(ta)
    flushSync()
    // Without a parent writing value back, the textarea must keep the typed text.
    expect(ta.value).toBe('hello world')
  })

  it('exposes combobox ARIA wiring on the textarea', async () => {
    const { container } = render(IrisMentions, { props: { options } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.getAttribute('role')).toBe('combobox')
    expect(ta.getAttribute('aria-autocomplete')).toBe('list')
    expect(ta.getAttribute('aria-expanded')).toBe('false')
    ta.value = '@'
    ta.setSelectionRange(1, 1)
    await fireEvent.input(ta)
    flushSync()
    expect(ta.getAttribute('aria-expanded')).toBe('true')
    const list = container.querySelector('[data-iris-mentions-list]')!
    expect(ta.getAttribute('aria-controls')).toBe(list.id)
    expect(ta.getAttribute('aria-activedescendant')).toBe(
      container.querySelector('[role="option"]')!.id,
    )
  })
})
