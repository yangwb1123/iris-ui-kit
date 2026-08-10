import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisMentions, type IrisMentionOption } from './Mentions'

afterEach(() => cleanup())

const OPTS: IrisMentionOption[] = [
  { label: 'Alice', value: 'alice' },
  { label: 'Bob', value: 'bob' },
]

const options = (c: HTMLElement) => c.querySelectorAll('[data-iris-mentions-option]')
const listbox = (c: HTMLElement) => c.querySelector('[role="listbox"]') as HTMLUListElement
const spacers = (c: HTMLElement) => c.querySelectorAll('[data-iris-mentions-spacer]')
const makeOptions = (n: number): IrisMentionOption[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))
/** Mention listbox rows are a constant 32px estimate (see ROW_HEIGHT). */
const ROW = 32

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

describe('IrisMentions virtual listbox', () => {
  const open = (c: HTMLElement) =>
    fireEvent.change(c.querySelector('textarea')!, { target: { value: '@', selectionStart: 1 } })

  it('A1: virtual off (omitted) — all options rendered, no spacers, no new DOM', () => {
    const { container } = render(<IrisMentions options={makeOptions(3)} />)
    open(container)
    expect(options(container).length).toBe(3)
    expect(spacers(container).length).toBe(0)
    expect(options(container)[0]!.id).toMatch(/-opt-0$/)
  })

  it('A1: virtual={false} explicit — identical to the default path', () => {
    const { container } = render(<IrisMentions options={makeOptions(3)} virtual={false} />)
    open(container)
    expect(options(container).length).toBe(3)
    expect(spacers(container).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', () => {
    const { container } = render(<IrisMentions options={makeOptions(3)} virtual />)
    open(container)
    expect(options(container).length).toBe(3)
    const sp = spacers(container)
    expect(sp.length).toBe(2)
    const top = sp[0] as HTMLElement
    const bottom = sp[1] as HTMLElement
    expect(top.getAttribute('data-iris-mentions-spacer-type')).toBe('top')
    expect(bottom.getAttribute('data-iris-mentions-spacer-type')).toBe('bottom')
    expect(parseFloat(top.style.height)).toBe(0)
    expect(parseFloat(bottom.style.height)).toBe(0)
    expect(
      parseFloat(top.style.height) +
        options(container).length * ROW +
        parseFloat(bottom.style.height),
    ).toBe(3 * ROW)
    // windowed options carry ARIA virtual-list positions
    expect(options(container)[0]!.getAttribute('aria-setsize')).toBe('3')
    expect(options(container)[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('A2: 10k options — only the window (+ buffer) is rendered', () => {
    const { container } = render(<IrisMentions options={makeOptions(10_000)} virtual />)
    open(container)
    const rendered = options(container)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(60)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    const ids = Array.from(rendered).map((o) => parseInt(o.id.split('-opt-')[1]!, 10))
    for (let i = 1; i < ids.length; i++) expect(ids[i]).toBe(ids[i - 1]! + 1)
    const sp = spacers(container)
    const top = sp[0] as HTMLElement
    const bottom = sp[1] as HTMLElement
    expect(parseFloat(top.style.height)).toBe(0)
    expect(top.getAttribute('aria-hidden')).toBe('true')
    expect(top.getAttribute('role')).toBe('presentation')
    expect(
      parseFloat(top.style.height) + rendered.length * ROW + parseFloat(bottom.style.height),
    ).toBe(10_000 * ROW)
  })

  it('A3: ArrowDown across the window edge scrolls (scrollTop === 88)', () => {
    const { container } = render(<IrisMentions options={makeOptions(10_000)} virtual />)
    const ta = container.querySelector('textarea')!
    open(container)
    for (let i = 0; i < 8; i++) fireEvent.keyDown(ta, { key: 'ArrowDown' })
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-8$/)
    const active = document.getElementById(ta.getAttribute('aria-activedescendant')!)
    expect(active).not.toBeNull()
    expect(active!.getAttribute('role')).toBe('option')
    expect(listbox(container).scrollTop).toBe(88)
  })

  it('A3: ArrowUp after scrolling is a no-op while the option is visible', () => {
    const { container } = render(<IrisMentions options={makeOptions(10_000)} virtual />)
    const ta = container.querySelector('textarea')!
    open(container)
    for (let i = 0; i < 8; i++) fireEvent.keyDown(ta, { key: 'ArrowDown' })
    fireEvent.keyDown(ta, { key: 'ArrowUp' })
    fireEvent.keyDown(ta, { key: 'ArrowUp' })
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-6$/)
    expect(listbox(container).scrollTop).toBe(88)
  })

  it('A3: wheel scroll drives the window without fighting the active item', () => {
    const { container } = render(<IrisMentions options={makeOptions(10_000)} virtual />)
    open(container)
    const lb = listbox(container)
    lb.scrollTop = 31_800
    fireEvent.scroll(lb)
    const rendered = options(container)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(60)
    expect(rendered[0]!.id).toMatch(/-opt-989$/)
  })

  it('A4: keystroke re-anchors the window to 0 (filtered to 100 matches)', () => {
    const mixed = [
      ...makeOptions(9_900),
      ...makeOptions(100).map((o, i) => ({ ...o, label: `target-${i}`, value: `target-${i}` })),
    ]
    const { container } = render(<IrisMentions options={mixed} virtual />)
    const ta = container.querySelector('textarea')!
    open(container)
    const lb = listbox(container)
    lb.scrollTop = 31_800
    fireEvent.scroll(lb)
    fireEvent.change(ta, { target: { value: '@target', selectionStart: 7 } })
    const rendered = options(container)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    expect(ta.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    expect(lb.scrollTop).toBe(0)
    const sp = spacers(container)
    expect(parseFloat((sp[0] as HTMLElement).style.height)).toBe(0)
    expect(
      parseFloat((sp[0] as HTMLElement).style.height) +
        rendered.length * ROW +
        parseFloat((sp[1] as HTMLElement).style.height),
    ).toBe(100 * ROW)
  })

  it('A4: external options swap clamps scroll (31,800 → 3,000, first -opt-89)', () => {
    const { container, rerender } = render(<IrisMentions options={makeOptions(10_000)} virtual />)
    open(container)
    const lb = listbox(container)
    lb.scrollTop = 31_800
    fireEvent.scroll(lb)
    rerender(<IrisMentions options={makeOptions(100)} virtual />)
    const rendered = options(container)
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

  it('A4: filter to zero matches — no listbox, no activedescendant', () => {
    const { container } = render(<IrisMentions options={makeOptions(10_000)} virtual />)
    const ta = container.querySelector('textarea')!
    open(container)
    fireEvent.change(ta, { target: { value: '@zzz', selectionStart: 4 } })
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    expect(ta.getAttribute('aria-activedescendant')).toBeNull()
    expect(ta.getAttribute('aria-expanded')).toBe('false')
  })
})
