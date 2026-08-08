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

describe('IrisMentions virtual listbox (svelte)', () => {
  const makeOptions = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))
  const spacers = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-iris-mentions-spacer]'))
  /** Mention listbox rows are a constant 32px estimate (see ROW_HEIGHT). */
  const ROW = 32

  it('A1: virtual off (default) — all options, no spacers', async () => {
    const { container } = render(IrisMentions, { props: { options: makeOptions(3) } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    expect(listItems(container).length).toBe(3)
    expect(spacers(container).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', async () => {
    const { container } = render(IrisMentions, {
      props: { options: makeOptions(3), virtual: true },
    })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    const rendered = listItems(container)
    expect(rendered.length).toBe(3)
    const sp = spacers(container)
    expect(sp.length).toBe(2)
    expect(sp[0]!.getAttribute('data-iris-mentions-spacer-type')).toBe('top')
    expect(sp[1]!.getAttribute('data-iris-mentions-spacer-type')).toBe('bottom')
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(parseFloat(sp[1]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) + rendered.length * ROW + parseFloat(sp[1]!.style.height),
    ).toBe(3 * ROW)
    expect(rendered[0]!.getAttribute('aria-setsize')).toBe('3')
    expect(rendered[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('A2: 10k options — windowed render with spacer invariant', async () => {
    const { container } = render(IrisMentions, {
      props: { options: makeOptions(10_000), virtual: true },
    })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    const rendered = listItems(container)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(60)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    const sp = spacers(container)
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) + rendered.length * ROW + parseFloat(sp[1]!.style.height),
    ).toBe(10_000 * ROW)
  })

  it('A3: ArrowDown across the window edge scrolls (scrollTop === 88)', async () => {
    const { container } = render(IrisMentions, {
      props: { options: makeOptions(10_000), virtual: true },
    })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    for (let i = 0; i < 8; i++) {
      await fireEvent.keyDown(ta, { key: 'ArrowDown' })
      flushSync()
    }
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-8$/)
    const lb = container.querySelector('[role="listbox"]') as HTMLElement
    expect(lb.scrollTop).toBe(88)
  })

  it('A4: keystroke re-anchors the window to 0 (filtered to 100 matches)', async () => {
    const mixed = [
      ...makeOptions(9_900),
      ...makeOptions(100).map((o, i) => ({ ...o, label: `target-${i}`, value: `target-${i}` })),
    ]
    const { container } = render(IrisMentions, { props: { options: mixed, virtual: true } })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    const lb = container.querySelector('[role="listbox"]') as HTMLElement
    lb.scrollTop = 31_800
    await fireEvent.scroll(lb)
    flushSync()
    await typeAt(ta, '@target', 7)
    const rendered = listItems(container)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    expect(lb.scrollTop).toBe(0)
    const sp = spacers(container)
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) + rendered.length * ROW + parseFloat(sp[1]!.style.height),
    ).toBe(100 * ROW)
  })

  it('A4: external options swap clamps scroll (31,800 → 3,000, first -opt-89)', async () => {
    const { container, rerender } = render(IrisMentions, {
      props: { options: makeOptions(10_000), virtual: true },
    })
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    await typeAt(ta, '@', 1)
    const lb = container.querySelector('[role="listbox"]') as HTMLElement
    lb.scrollTop = 31_800
    await fireEvent.scroll(lb)
    flushSync()
    await rerender({ options: makeOptions(100), virtual: true })
    flushSync()
    const rendered = listItems(container)
    expect(rendered[0]!.id).toMatch(/-opt-89$/)
    expect(lb.scrollTop).toBe(3_000)
    const sp = spacers(container)
    const top = sp[0] as HTMLElement
    const bottom = sp[1] as HTMLElement
    expect(parseFloat(bottom.style.height)).toBe(0)
    expect(
      parseFloat(top.style.height) + rendered.length * ROW + parseFloat(bottom.style.height),
    ).toBe(100 * ROW)
  })
})
