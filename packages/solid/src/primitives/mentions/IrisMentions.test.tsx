import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisMentions, type IrisMentionOption } from './IrisMentions'

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

describe('IrisMentions virtual listbox', () => {
  const makeOptions = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))
  const spacers = (container: HTMLElement): HTMLElement[] =>
    Array.from(container.querySelectorAll('[data-iris-mentions-spacer]'))
  const listboxEl = (container: HTMLElement) =>
    container.querySelector('[role="listbox"]') as HTMLElement
  /** Mention listbox rows are a constant 32px estimate (see ROW_HEIGHT). */
  const ROW = 32

  it('A1: virtual off (default) — all options, no spacers', () => {
    const { container } = render(() => <IrisMentions options={makeOptions(3)} />)
    fireEvent.input(textareaEl(container), { target: { value: '@' } })
    expect(listboxItems(container).length).toBe(3)
    expect(spacers(container).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', () => {
    const { container } = render(() => <IrisMentions options={makeOptions(3)} virtual />)
    fireEvent.input(textareaEl(container), { target: { value: '@' } })
    const rendered = listboxItems(container)
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

  it('A2: 10k options — windowed render with spacer invariant', () => {
    const { container } = render(() => <IrisMentions options={makeOptions(10_000)} virtual />)
    fireEvent.input(textareaEl(container), { target: { value: '@' } })
    const rendered = listboxItems(container)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(60)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    const sp = spacers(container)
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) + rendered.length * ROW + parseFloat(sp[1]!.style.height),
    ).toBe(10_000 * ROW)
  })

  it('A3: ArrowDown across the window edge scrolls (scrollTop === 88)', () => {
    const { container } = render(() => <IrisMentions options={makeOptions(10_000)} virtual />)
    const ta = textareaEl(container)
    fireEvent.input(ta, { target: { value: '@' } })
    for (let i = 0; i < 8; i++) fireEvent.keyDown(ta, { key: 'ArrowDown' })
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-8$/)
    expect(listboxEl(container).scrollTop).toBe(88)
  })

  it('A4: keystroke re-anchors the window to 0 (filtered to 100 matches)', () => {
    const mixed = [
      ...makeOptions(9_900),
      ...makeOptions(100).map((o, i) => ({ ...o, label: `target-${i}`, value: `target-${i}` })),
    ]
    const { container } = render(() => <IrisMentions options={mixed} virtual />)
    const ta = textareaEl(container)
    fireEvent.input(ta, { target: { value: '@' } })
    const lb = listboxEl(container)
    lb.scrollTop = 31_800
    fireEvent.scroll(lb)
    fireEvent.input(ta, { target: { value: '@target' } })
    const rendered = listboxItems(container)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    expect(lb.scrollTop).toBe(0)
    const sp = spacers(container)
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) + rendered.length * ROW + parseFloat(sp[1]!.style.height),
    ).toBe(100 * ROW)
  })

  it('A4: external options swap clamps scroll (31,800 → 3,000, first -opt-89)', () => {
    const [opts, setOpts] = createSignal<IrisMentionOption[]>(makeOptions(10_000))
    const { container } = render(() => <IrisMentions options={opts()} virtual />)
    const ta = textareaEl(container)
    fireEvent.input(ta, { target: { value: '@' } })
    const lb = listboxEl(container)
    lb.scrollTop = 31_800
    fireEvent.scroll(lb)
    setOpts(makeOptions(100))
    const rendered = listboxItems(container)
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
