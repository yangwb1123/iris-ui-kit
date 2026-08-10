import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisSelect from './IrisSelect.svelte'

afterEach(cleanup)

const items = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('IrisSelect', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisSelect, { props: { items } })
    expect(container).toBeTruthy()
  })

  it('shows placeholder when no value', () => {
    const { container } = render(IrisSelect, { props: { items, placeholder: 'Pick one' } })
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent?.trim()).toContain(
      'Pick one',
    )
  })

  it('opens listbox on click', async () => {
    const { container } = render(IrisSelect, { props: { items } })
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    await fireEvent.click(trigger)
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('calls onValueChange when option clicked', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisSelect, { props: { items, onValueChange } })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    const opts = document.querySelectorAll('[data-iris-select-option]')
    await fireEvent.click(opts[1])
    expect(onValueChange).toHaveBeenCalledWith('banana')
  })

  it('uses defaultValue and updates its label in uncontrolled mode', async () => {
    const { container } = render(IrisSelect, {
      props: { items, defaultValue: 'apple', portalTarget: false },
    })
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    expect(trigger.textContent).toContain('Apple')
    await fireEvent.click(trigger)
    await fireEvent.click(container.querySelectorAll('[data-iris-select-option]')[1]!)
    expect(trigger.textContent).toContain('Banana')
  })

  it('forwards invalid and described-by semantics to the trigger', () => {
    const { container } = render(IrisSelect, {
      props: { items, invalid: true, ariaDescribedby: 'fruit-error' },
    })
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(trigger.getAttribute('aria-describedby')).toBe('fruit-error')
  })

  it('uses rerendered item labels for typeahead navigation', async () => {
    const { container, rerender } = render(IrisSelect, {
      props: {
        items: [
          { label: 'One', value: 'one' },
          { label: 'Two', value: 'two' },
        ],
        portalTarget: false,
      },
    })
    await rerender({
      items: [
        { label: 'One', value: 'one' },
        { label: 'Xylophone', value: 'xylophone' },
      ],
      portalTarget: false,
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    const listbox = container.querySelector('[data-iris-select-listbox]')!
    const options = container.querySelectorAll<HTMLElement>('[data-iris-select-option]')
    await fireEvent.keyDown(listbox, { key: 'x' })
    expect(document.activeElement).toBe(options[1])
  })

  describe('keyboard navigation', () => {
    const optionEls = () =>
      Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[]
    const listbox = () => document.querySelector('[data-iris-select-listbox]') as HTMLElement

    it('focuses the first option on open, ArrowDown moves to next, Enter selects it', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisSelect, { props: { items, onValueChange } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve() // flush the focusOnOpen microtask
      const options = optionEls()
      expect(document.activeElement).toBe(options[0])
      await fireEvent.keyDown(listbox(), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(options[1])
      await fireEvent.keyDown(options[1], { key: 'Enter' })
      expect(onValueChange).toHaveBeenCalledWith('banana')
    })

    it('ArrowUp moves to previous option', async () => {
      const { container } = render(IrisSelect, { props: { items } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve()
      const options = optionEls()
      // Start at first option, ArrowUp wraps to last
      await fireEvent.keyDown(listbox(), { key: 'ArrowUp' })
      expect(document.activeElement).toBe(options[2])
      // ArrowUp again wraps to second-to-last
      await fireEvent.keyDown(listbox(), { key: 'ArrowUp' })
      expect(document.activeElement).toBe(options[1])
    })

    it('End focuses the last option, Home the first', async () => {
      const { container } = render(IrisSelect, { props: { items } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve()
      const options = optionEls()
      await fireEvent.keyDown(listbox(), { key: 'End' })
      expect(document.activeElement).toBe(options[2])
      await fireEvent.keyDown(listbox(), { key: 'Home' })
      expect(document.activeElement).toBe(options[0])
    })

    it('opens on selected value and focuses the selected option', async () => {
      const { container } = render(IrisSelect, { props: { items, value: 'cherry' } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve()
      expect(document.activeElement).toBe(optionEls()[2])
    })

    it('Space key selects the focused option', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisSelect, { props: { items, onValueChange } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      await Promise.resolve()
      const options = optionEls()
      await fireEvent.keyDown(options[1], { key: ' ' })
      expect(onValueChange).toHaveBeenCalledWith('banana')
    })

    it('Escape closes the listbox', async () => {
      const { container } = render(IrisSelect, { props: { items } })
      await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
      expect(document.querySelector('[role="listbox"]')).not.toBeNull()
      await fireEvent.keyDown(listbox(), { key: 'Escape' })
      expect(document.querySelector('[role="listbox"]')).toBeNull()
    })
  })
})

describe('IrisSelect virtual listbox', () => {
  const makeItems = (n: number): { value: number; label: string }[] =>
    Array.from({ length: n }, (_, i) => ({ value: i, label: `Option ${i}` }))
  const ROW_HEIGHT = 36
  const listbox = () => document.querySelector('[data-iris-select-listbox]') as HTMLElement
  const optionEls = () =>
    Array.from(document.querySelectorAll('[data-iris-select-option]')) as HTMLElement[]
  const spacerEls = () =>
    Array.from(document.querySelectorAll('[data-iris-select-spacer]')) as HTMLElement[]
  const indexOf = (el: HTMLElement) =>
    parseInt(el.getAttribute('data-iris-select-option-index') ?? '-1', 10)

  it('A1: virtual off (default) — all options, no spacers', async () => {
    const { container } = render(IrisSelect, { props: { items } })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    expect(optionEls().length).toBe(3)
    expect(spacerEls().length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', async () => {
    const { container } = render(IrisSelect, { props: { items, virtual: true } })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    expect(optionEls().length).toBe(3)
    const sp = spacerEls()
    expect(sp.length).toBe(2)
    expect(sp[0]!.getAttribute('data-iris-select-spacer-type')).toBe('top')
    expect(sp[1]!.getAttribute('data-iris-select-spacer-type')).toBe('bottom')
    expect(sp[0]!.getAttribute('role')).toBe('presentation')
    expect(sp[0]!.getAttribute('aria-hidden')).toBe('true')
    expect(
      parseFloat(sp[0]!.style.height) +
        optionEls().length * ROW_HEIGHT +
        parseFloat(sp[1]!.style.height),
    ).toBe(3 * ROW_HEIGHT)
    expect(optionEls()[0]!.getAttribute('aria-setsize')).toBe('3')
    expect(optionEls()[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('A2: 10k options — only the window (+ buffer) is rendered, spacer invariant', async () => {
    const { container } = render(IrisSelect, { props: { items: makeItems(10_000), virtual: true } })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    const rendered = optionEls()
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThan(60)
    expect(indexOf(rendered[0]!)).toBe(0)
    for (let i = 1; i < rendered.length; i++) {
      expect(indexOf(rendered[i]!)).toBe(indexOf(rendered[i - 1]!) + 1)
    }
    const sp = spacerEls()
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) +
        rendered.length * ROW_HEIGHT +
        parseFloat(sp[1]!.style.height),
    ).toBe(360_000)
  })

  it('A2: items shrink re-windows and clamps scroll to 0', async () => {
    const { container, rerender } = render(IrisSelect, {
      props: { items: makeItems(10_000), virtual: true },
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    const lb = listbox()
    lb.scrollTop = 1000
    await fireEvent.scroll(lb)
    await Promise.resolve()
    expect(indexOf(optionEls()[0]!)).toBeGreaterThan(0)
    await rerender({ items: makeItems(3), virtual: true })
    await Promise.resolve()
    expect(lb.scrollTop).toBe(0)
    expect(indexOf(optionEls()[0]!)).toBe(0)
  })

  it('A3: open with value at index 9999 — scrolls and focuses the active option', async () => {
    const { container } = render(IrisSelect, {
      props: { items: makeItems(10_000), value: 9999, virtual: true },
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    await Promise.resolve()
    expect(listbox().scrollTop).toBe(359_760)
    const deep = document.querySelector('[data-iris-select-option-index="9999"]') as HTMLElement
    expect(deep).not.toBeNull()
    expect(deep.getAttribute('aria-posinset')).toBe('10000')
    expect(document.activeElement).toBe(deep)
  })

  it('A3: reopen after a deep session with no value resets to top', async () => {
    const { container, rerender } = render(IrisSelect, {
      props: { items: makeItems(10_000), value: 9999, virtual: true },
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    expect(listbox().scrollTop).toBe(359_760)
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!) // close
    await rerender({ items: makeItems(10_000), virtual: true, value: undefined }) // no value
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!) // reopen
    await Promise.resolve()
    await Promise.resolve()
    expect(listbox().scrollTop).toBe(0)
    expect(indexOf(optionEls()[0]!)).toBe(0)
  })

  it('A4: End scrolls the last option into view (maxScroll)', async () => {
    const { container } = render(IrisSelect, {
      props: { items: makeItems(10_000), virtual: true },
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    await fireEvent.keyDown(listbox(), { key: 'End' })
    await Promise.resolve()
    expect(listbox().scrollTop).toBe(359_760)
    expect(document.querySelector('[data-iris-select-option-index="9999"]')).not.toBeNull()
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('9999')
  })

  it('A4: wheel scroll drives the window — nav then re-scrolls', async () => {
    const { container } = render(IrisSelect, {
      props: { items: makeItems(10_000), virtual: true },
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    const lb = listbox()
    lb.scrollTop = 1000
    await fireEvent.scroll(lb)
    await Promise.resolve()
    expect(indexOf(optionEls()[0]!)).toBe(23) // floor((1000 − 4×36)/36)
    await fireEvent.keyDown(listbox(), { key: 'ArrowDown' })
    await Promise.resolve()
    expect(listbox().scrollTop).toBe(36)
    expect(document.activeElement?.getAttribute('data-iris-select-option-index')).toBe('1')
  })

  it('A5: empty state with virtual — no options, no spacers', async () => {
    const { container } = render(IrisSelect, { props: { items: [], virtual: true } })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    expect(optionEls().length).toBe(0)
    expect(spacerEls().length).toBe(0)
    expect(document.querySelector('[data-iris-select-empty]')).not.toBeNull()
  })

  it('A5: disabled options render and ignore clicks in both modes', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisSelect, {
      props: {
        items: [
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana', disabled: true },
          { value: 'c', label: 'Cherry' },
        ],
        virtual: true,
        onValueChange,
      },
    })
    await fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    await Promise.resolve()
    const disabled = optionEls().find((o) => o.getAttribute('aria-disabled') === 'true')
    expect(disabled).toBeDefined()
    await fireEvent.click(disabled!)
    expect(onValueChange).not.toHaveBeenCalled()
    expect(document.querySelector('[data-iris-select-listbox]')).not.toBeNull()
  })
})
