import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisMentions from './IrisMentions.svelte'

const options = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
  { label: 'Charlie', value: 'charlie' },
]

async function typeAt(ta: HTMLTextAreaElement, text: string, caret?: number): Promise<void> {
  ta.value = text
  ta.setSelectionRange(caret ?? text.length, caret ?? text.length)
  await fireEvent.input(ta)
  flushSync()
}

function listboxEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-mentions-list]')
}
function listItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-mentions-item]'))
}

describe('IrisMentions (svelte)', () => {
  it('renders a textarea', () => {
    const { container } = render(IrisMentions, { props: { options } })
    expect(container.querySelector('[data-iris-mentions-textarea]')).toBeTruthy()
  })

  it('shows suggestion list on @ trigger', async () => {
    const { container } = render(IrisMentions, { props: { options } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    expect(listboxEl(container)).toBeTruthy()
  })

  it('does not show list without @', () => {
    const { container } = render(IrisMentions, { props: { options, value: 'hello' } })
    expect(listboxEl(container)).toBeFalsy()
  })

  it('updates the textarea when uncontrolled (no value bound)', async () => {
    const { container } = render(IrisMentions, { props: { options } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, 'hello world')
    expect(ta.value).toBe('hello world')
  })

  it('exposes combobox ARIA wiring on the textarea', async () => {
    const { container } = render(IrisMentions, { props: { options } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.getAttribute('role')).toBe('combobox')
    expect(ta.getAttribute('aria-autocomplete')).toBe('list')
    expect(ta.getAttribute('aria-expanded')).toBe('false')
    await typeAt(ta, '@', 1)
    expect(ta.getAttribute('aria-expanded')).toBe('true')
    const list = listboxEl(container)!
    expect(ta.getAttribute('aria-controls')).toBe(list.id)
  })

  it('disabled textarea has disabled attribute', () => {
    const { container } = render(IrisMentions, { props: { options, disabled: true } })
    expect(container.querySelector('textarea')?.hasAttribute('disabled')).toBe(true)
  })

  describe('controlled mode', () => {
    it('shows the controlled value', () => {
      const { container } = render(IrisMentions, { props: { options, value: 'Hello @alice' } })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      expect(ta.value).toBe('Hello @alice')
    })
  })

  describe('@ filter behavior', () => {
    it('shows all options when @ typed alone', async () => {
      const { container } = render(IrisMentions, { props: { options } })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      await typeAt(ta, '@', 1)
      const items = listItems(container)
      expect(items.length).toBe(3)
    })

    it('filters options based on @ query', async () => {
      const { container } = render(IrisMentions, { props: { options } })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      await typeAt(ta, '@al', 3)
      const items = listItems(container)
      expect(items.length).toBe(1)
      expect(items[0]?.textContent?.trim()).toBe('Alice')
    })

    it('does not show list for text without @', async () => {
      const { container } = render(IrisMentions, { props: { options } })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      await typeAt(ta, 'hello world')
      expect(listboxEl(container)).toBeFalsy()
    })
  })

  describe('selection', () => {
    it('selects an option on click and inserts into text', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisMentions, {
        props: { options, onValueChange },
      })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      await typeAt(ta, '@b', 2)
      const items = listItems(container)
      expect(items.length).toBe(1) // Bob filtered
      await fireEvent.click(items[0]!)
      flushSync()
      expect(ta.value).toContain('Bob')
      expect(onValueChange).toHaveBeenCalled()
    })
  })

  describe('keyboard', () => {
    it('Escape closes the listbox', async () => {
      const { container } = render(IrisMentions, { props: { options } })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      await typeAt(ta, '@', 1)
      expect(listboxEl(container)).toBeTruthy()
      await fireEvent.keyDown(ta, { key: 'Escape' })
      flushSync()
      expect(listboxEl(container)).toBeFalsy()
    })
  })

  describe('edge cases', () => {
    it('handles empty options', async () => {
      const { container } = render(IrisMentions, { props: { options: [] } })
      const ta = container.querySelector('textarea') as HTMLTextAreaElement
      await typeAt(ta, '@', 1)
      expect(container.querySelector('[data-iris-mentions]')).toBeTruthy()
    })
  })
})
