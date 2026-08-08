import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSelect } from './Select'

afterEach(() => cleanup())

const items = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', disabled: true },
  { value: 'd', label: 'Delta' },
]

function trigger(): HTMLButtonElement {
  return document.querySelector('[data-iris-select-trigger]') as HTMLButtonElement
}
function listbox(): HTMLElement | null {
  return document.querySelector('[role=listbox]')
}
function options(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=option]'))
}

describe('@iris-ui-kit/react IrisSelect virtual listbox', () => {
  const makeItems = (n: number): { value: number; label: string }[] =>
    Array.from({ length: n }, (_, i) => ({ value: i, label: `Option ${i}` }))
  const ROW_HEIGHT = 36
  const MAX_SCROLL = 10_000 * ROW_HEIGHT - 240

  function spacers(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[data-iris-select-spacer]'))
  }
  function spacerSum(): number {
    const [top, bottom] = spacers()
    return (
      parseFloat((top as HTMLElement).style.height) +
      options().length * ROW_HEIGHT +
      parseFloat((bottom as HTMLElement).style.height)
    )
  }
  function optionIndexes(): number[] {
    return Array.from(document.querySelectorAll('[data-iris-select-option-index]')).map((o) =>
      parseInt(o.getAttribute('data-iris-select-option-index')!, 10),
    )
  }

  it('A1: virtual off (omitted) — all options rendered, no spacers, no new ARIA', () => {
    render(<IrisSelect items={items} />)
    act(() => {
      fireEvent.click(trigger())
    })
    expect(options().length).toBe(4)
    expect(spacers().length).toBe(0)
    expect(options()[0]!.getAttribute('aria-setsize')).toBeNull()
    expect(options()[0]!.getAttribute('aria-posinset')).toBeNull()
  })

  it('A1: virtual={false} explicit — identical to the default path', () => {
    render(<IrisSelect items={items} virtual={false} />)
    act(() => {
      fireEvent.click(trigger())
    })
    expect(options().length).toBe(4)
    expect(spacers().length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', () => {
    render(<IrisSelect items={items} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    expect(options().length).toBe(4)
    const sp = spacers()
    expect(sp.length).toBe(2)
    expect(sp[0]!.getAttribute('data-iris-select-spacer-type')).toBe('top')
    expect(sp[1]!.getAttribute('data-iris-select-spacer-type')).toBe('bottom')
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(parseFloat(sp[1]!.style.height)).toBe(0)
    expect(spacerSum()).toBe(4 * ROW_HEIGHT)
    expect(options()[0]!.getAttribute('aria-setsize')).toBe('4')
    expect(options()[0]!.getAttribute('aria-posinset')).toBe('1')
    expect(options()[3]!.getAttribute('aria-posinset')).toBe('4')
    expect(sp[0]!.getAttribute('role')).toBe('presentation')
    expect(sp[0]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('A2: 10k options — only the window (+ buffer) is rendered, contiguous from 0', () => {
    render(<IrisSelect items={makeItems(10_000)} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    const rendered = options()
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThan(60)
    const idx = optionIndexes()
    expect(idx[0]).toBe(0)
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBe(idx[i - 1]! + 1)
    const [top] = spacers()
    expect(parseFloat(top!.style.height)).toBe(0)
    expect(spacerSum()).toBe(360_000)
  })

  it('A2: items shrink re-windows and clamps scroll to 0', () => {
    const { rerender } = render(<IrisSelect items={makeItems(10_000)} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    const lb = listbox()!
    lb.scrollTop = 1000
    act(() => {
      fireEvent.scroll(lb)
    })
    expect(optionIndexes()[0]!).toBeGreaterThan(0)
    rerender(<IrisSelect items={makeItems(3)} virtual />)
    expect(lb.scrollTop).toBe(0)
    expect(optionIndexes()[0]).toBe(0)
    expect(spacerSum()).toBe(3 * ROW_HEIGHT)
  })

  it('A3: open with value at index 9999 — scrolls and focuses the active option', () => {
    render(<IrisSelect items={makeItems(10_000)} value={9999} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    const lb = listbox()!
    expect(lb.scrollTop).toBe(359_760) // 9999×36 + 36 − 240, clamped
    const deep = document.querySelector('[data-iris-select-option-index="9999"]') as HTMLElement
    expect(deep).not.toBeNull()
    expect(deep.getAttribute('tabindex')).toBe('0')
    expect(deep.getAttribute('aria-posinset')).toBe('10000')
    expect(document.activeElement).toBe(deep)
  })

  it('A3: closed-trigger typeahead deep match scrolls into view', () => {
    const deepItems = makeItems(10_000)
    deepItems[9999] = { value: 9999, label: 'z9999' } // the only label with a 'z' prefix
    render(<IrisSelect items={deepItems} virtual />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'z' })
    })
    expect(listbox()).not.toBeNull()
    expect(listbox()!.scrollTop).toBeGreaterThan(0)
    const deep = document.querySelector('[data-iris-select-option-index="9999"]') as HTMLElement
    expect(deep).not.toBeNull()
    expect(deep.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(deep)
  })

  it('A3: closed-trigger ArrowDown open with no value — scrollTop 0, first option focused', () => {
    render(<IrisSelect items={makeItems(10_000)} virtual />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()!.scrollTop).toBe(0)
    expect(document.activeElement).toBe(options()[0])
  })

  it('A3: reopen after a deep session with no value resets to top', () => {
    const { rerender } = render(<IrisSelect items={makeItems(10_000)} value={9999} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    expect(listbox()!.scrollTop).toBe(359_760)
    act(() => {
      fireEvent.click(trigger()) // close
    })
    expect(listbox()).toBeNull()
    rerender(<IrisSelect items={makeItems(10_000)} virtual />) // no value now
    act(() => {
      fireEvent.click(trigger()) // reopen
    })
    expect(listbox()!.scrollTop).toBe(0)
    expect(document.activeElement).toBe(options()[0])
  })

  it('A4: End scrolls the last option into view; ArrowUp after End is a no-op', () => {
    render(<IrisSelect items={makeItems(10_000)} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'End' })
    })
    expect(listbox()!.scrollTop).toBe(MAX_SCROLL)
    const last = document.querySelector('[data-iris-select-option-index="9999"]') as HTMLElement
    expect(last).not.toBeNull()
    expect(last.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(last)
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'ArrowUp' })
    })
    expect(listbox()!.scrollTop).toBe(MAX_SCROLL)
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('9998')
  })

  it('A4: Home scrolls back to the top', () => {
    render(<IrisSelect items={makeItems(10_000)} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'End' })
    })
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'Home' })
    })
    expect(listbox()!.scrollTop).toBe(0)
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('0')
  })

  it('A4: ArrowDown across the window edge re-windows (6→12px, 7→48px)', () => {
    render(<IrisSelect items={makeItems(10_000)} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    for (let i = 1; i <= 7; i++) {
      act(() => {
        fireEvent.keyDown(listbox()!, { key: 'ArrowDown' })
      })
      expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe(String(i))
      expect(document.activeElement?.getAttribute('tabindex')).toBe('0')
      expect(listbox()!.scrollTop).toBe(i === 6 ? 12 : i === 7 ? 48 : 0)
    }
  })

  it('A4: Enter after End commits the correct item by index (outside the initial window)', () => {
    const onChange = vi.fn()
    render(<IrisSelect items={makeItems(10_000)} onValueChange={onChange} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'End' })
    })
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'Enter' })
    })
    expect(onChange).toHaveBeenCalledWith(9999)
    expect(listbox()).toBeNull()
  })

  it('A4: wheel scroll drives the window — active index untouched until a nav key', () => {
    render(<IrisSelect items={makeItems(10_000)} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    const lb = listbox()!
    lb.scrollTop = 1000
    act(() => {
      fireEvent.scroll(lb)
    })
    // first rendered = floor((1000 − 4×36)/36) = 23 (ROW_HEIGHT 36)
    expect(optionIndexes()[0]).toBe(23)
    // active index is untouched by the wheel (option 0 is unmounted, so no
    // element holds focus) — a nav key re-scrolls to the active option
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'ArrowDown' })
    })
    expect(listbox()!.scrollTop).toBe(36)
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('1')
  })

  it('A4: disabled items are skipped and scrolled into view', () => {
    const many = makeItems(10_000)
    many[5] = { value: 5, label: 'Option 5', disabled: true }
    many[9998] = { value: 9998, label: 'Option 9998', disabled: true }
    render(<IrisSelect items={many} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'End' })
    })
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('9999')
    for (let i = 0; i < 6; i++) {
      act(() => {
        fireEvent.keyDown(listbox()!, { key: 'ArrowDown' })
      })
    }
    // 9999 wraps (loop) → 0 → 1 → 2 → 3 → 4 → 6 (skips 5)
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('6')
    expect(listbox()!.scrollTop).toBe(12) // scrolled into view at the bottom edge
  })

  it('A4: closed-trigger keyboard suite passes with virtual on', () => {
    // ArrowDown anchor to the selected option
    render(<IrisSelect items={items} value="d" virtual />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(options()[3]!)
  })

  it('A4: closed-trigger typeahead highlights the match, not the selection (virtual)', () => {
    render(<IrisSelect items={items} value="d" virtual />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'b' })
    })
    expect(document.activeElement).toBe(options()[1]!) // Bravo, NOT Delta
  })

  it('A4: all-disabled with virtual — opens, focus stays on the trigger', () => {
    render(<IrisSelect items={items.map((it) => ({ ...it, disabled: true }))} virtual />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('A5: empty state with virtual — no options, no spacers', () => {
    render(<IrisSelect items={[]} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    expect(listbox()).not.toBeNull()
    expect(options().length).toBe(0)
    expect(spacers().length).toBe(0)
    expect(document.querySelector('[data-iris-select-empty]')).not.toBeNull()
  })

  it('A5: disabled options render and ignore clicks in both modes', () => {
    const onChange = vi.fn()
    render(<IrisSelect items={items} onValueChange={onChange} virtual />)
    act(() => {
      fireEvent.click(trigger())
    })
    const c = options()[2]!
    expect(c.getAttribute('aria-disabled')).toBe('true')
    act(() => {
      fireEvent.click(c)
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(listbox()).not.toBeNull()
  })
})
