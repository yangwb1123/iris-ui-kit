import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisSelect } from './IrisSelect'

afterEach(cleanup)

const items = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

describe('IrisSelect', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisSelect items={items} />)
    expect(container.querySelector('[data-iris-select-trigger]')).not.toBeNull()
  })

  it('shows placeholder when no value selected', () => {
    const { getByText } = render(() => <IrisSelect items={items} placeholder="Choose fruit" />)
    expect(getByText('Choose fruit')).toBeTruthy()
  })

  it('opens listbox on click', () => {
    const { container } = render(() => <IrisSelect items={items} portalTarget={false} />)
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    expect(container.querySelector('[data-iris-select-listbox]')).toBeNull()
    fireEvent.click(trigger)
    expect(container.querySelector('[data-iris-select-listbox]')).not.toBeNull()
  })

  it('calls onChange when an item is selected', () => {
    const onChange = vi.fn()
    const { container, getByText } = render(() => (
      <IrisSelect items={items} onChange={onChange} portalTarget={false} />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    fireEvent.click(getByText('Banana'))
    expect(onChange).toHaveBeenCalledWith('banana')
  })

  it('calls onValueChange and preserves the legacy onChange alias', () => {
    const onValueChange = vi.fn()
    const onChange = vi.fn()
    const { container, getByText } = render(() => (
      <IrisSelect
        items={items}
        onValueChange={onValueChange}
        onChange={onChange}
        portalTarget={false}
      />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    fireEvent.click(getByText('Banana'))
    expect(onValueChange).toHaveBeenCalledWith('banana')
    expect(onChange).toHaveBeenCalledWith('banana')
  })

  it('uses defaultValue and updates its label in uncontrolled mode', () => {
    const { container, getByText } = render(() => (
      <IrisSelect items={items} defaultValue="apple" portalTarget={false} />
    ))
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent).toContain('Apple')
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    fireEvent.click(getByText('Banana'))
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent).toContain('Banana')
  })

  it('shows selected label in trigger', () => {
    const { container } = render(() => <IrisSelect items={items} value="cherry" />)
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent).toContain('Cherry')
  })

  describe('keyboard navigation', () => {
    const open = (c: HTMLElement) => {
      const trigger = c.querySelector('[data-iris-select-trigger]') as HTMLElement
      fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // opens + active = first enabled
      return trigger
    }

    it('End moves the active option to the last (Enter selects it)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSelect items={items} onChange={onChange} portalTarget={false} />
      ))
      const trigger = open(container)
      fireEvent.keyDown(trigger, { key: 'End' })
      fireEvent.keyDown(trigger, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('cherry')
    })

    it('Home moves the active option back to the first (Enter selects it)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSelect items={items} onChange={onChange} portalTarget={false} />
      ))
      const trigger = open(container)
      fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // active = banana
      fireEvent.keyDown(trigger, { key: 'Home' }) // active = apple
      fireEvent.keyDown(trigger, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('apple')
    })

    it('ArrowDown opens the listbox when closed', () => {
      const { container } = render(() => <IrisSelect items={items} portalTarget={false} />)
      const trigger = container.querySelector('[data-iris-select-trigger]')!
      expect(container.querySelector('[data-iris-select-listbox]')).toBeNull()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      expect(container.querySelector('[data-iris-select-listbox]')).not.toBeNull()
    })

    it('ArrowDown moves to the next option (Enter selects it)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSelect items={items} onChange={onChange} portalTarget={false} />
      ))
      const trigger = open(container) // ArrowDown: 0→1, opens, active = banana
      fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // 1→2, active = cherry
      fireEvent.keyDown(trigger, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('cherry')
    })

    it('ArrowUp moves to the previous option (Enter selects it)', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSelect items={items} onChange={onChange} portalTarget={false} />
      ))
      const trigger = open(container) // ArrowDown: 0→1, opens, active = banana
      fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // 1→2, active = cherry
      fireEvent.keyDown(trigger, { key: 'ArrowUp' }) // 2→1, active = banana
      fireEvent.keyDown(trigger, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith('banana')
    })

    it('Space opens the listbox', () => {
      const { container } = render(() => <IrisSelect items={items} portalTarget={false} />)
      const trigger = container.querySelector('[data-iris-select-trigger]')!
      expect(container.querySelector('[data-iris-select-listbox]')).toBeNull()
      fireEvent.keyDown(trigger, { key: ' ' })
      expect(container.querySelector('[data-iris-select-listbox]')).not.toBeNull()
    })

    it('Escape closes the listbox', () => {
      const { container } = render(() => <IrisSelect items={items} portalTarget={false} />)
      const trigger = container.querySelector('[data-iris-select-trigger]') as HTMLElement
      fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // open
      expect(container.querySelector('[data-iris-select-listbox]')).not.toBeNull()
      fireEvent.keyDown(trigger, { key: 'Escape' })
      expect(container.querySelector('[data-iris-select-listbox]')).toBeNull()
    })
  })
})

describe('IrisSelect virtual listbox', () => {
  const makeItems = (n: number): { value: number; label: string }[] =>
    Array.from({ length: n }, (_, i) => ({ value: i, label: `Option ${i}` }))
  const ROW_HEIGHT = 36

  const listbox = (c: HTMLElement) => c.querySelector('[data-iris-select-listbox]') as HTMLElement
  const optionEls = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('[data-iris-select-option]')) as HTMLElement[]
  const spacerEls = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('[data-iris-select-spacer]')) as HTMLElement[]
  const posinsets = (c: HTMLElement) =>
    optionEls(c).map((o) => parseInt(o.getAttribute('aria-posinset')!, 10))

  it('A1: virtual off (default) — all options, no spacers', () => {
    const { container } = render(() => <IrisSelect items={items} portalTarget={false} />)
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    expect(optionEls(container).length).toBe(3)
    expect(spacerEls(container).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', () => {
    const { container } = render(() => <IrisSelect items={items} virtual portalTarget={false} />)
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    expect(optionEls(container).length).toBe(3)
    const sp = spacerEls(container)
    expect(sp.length).toBe(2)
    expect(sp[0]!.getAttribute('data-iris-select-spacer-type')).toBe('top')
    expect(sp[1]!.getAttribute('data-iris-select-spacer-type')).toBe('bottom')
    expect(sp[0]!.getAttribute('role')).toBe('presentation')
    expect(
      parseFloat(sp[0]!.style.height) +
        optionEls(container).length * ROW_HEIGHT +
        parseFloat(sp[1]!.style.height),
    ).toBe(3 * ROW_HEIGHT)
    expect(optionEls(container)[0]!.getAttribute('aria-setsize')).toBe('3')
    expect(optionEls(container)[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('A2: 10k options — only the window (+ buffer) is rendered, spacer invariant', () => {
    const { container } = render(() => (
      <IrisSelect items={makeItems(10_000)} virtual portalTarget={false} />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    const rendered = optionEls(container)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThan(60)
    expect(rendered[0]!.getAttribute('aria-posinset')).toBe('1')
    const sp = spacerEls(container)
    expect(parseFloat(sp[0]!.style.height)).toBe(0)
    expect(
      parseFloat(sp[0]!.style.height) +
        rendered.length * ROW_HEIGHT +
        parseFloat(sp[1]!.style.height),
    ).toBe(360_000)
  })

  it('A2: items shrink re-windows and clamps scroll to 0', () => {
    const [items, setItems] = createSignal<{ value: number; label: string }[]>(makeItems(10_000))
    const { container } = render(() => <IrisSelect items={items()} virtual portalTarget={false} />)
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    const lb = listbox(container)
    lb.scrollTop = 1000
    fireEvent.scroll(lb)
    expect(posinsets(container)[0]!).toBeGreaterThan(1)
    setItems(() => makeItems(3))
    expect(lb.scrollTop).toBe(0)
    expect(optionEls(container)[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('A3: open with value at index 9999 — scrolls the active option into view', () => {
    const { container } = render(() => (
      <IrisSelect items={makeItems(10_000)} value={9999} virtual portalTarget={false} />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    expect(listbox(container).scrollTop).toBe(359_760)
    const deep = optionEls(container).find((o) => o.getAttribute('aria-posinset') === '10000')
    expect(deep).not.toBeNull()
  })

  it('A3: ArrowDown-open keeps Solid semantics (active = next, not anchored)', () => {
    const { container } = render(() => (
      <IrisSelect items={makeItems(10_000)} virtual portalTarget={false} />
    ))
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(listbox(container)).not.toBeNull()
    expect(listbox(container).scrollTop).toBe(0)
    // nav moved 0→1 on the opening keypress — the open-anchor must not clobber
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(container.querySelector('[data-iris-select-trigger]')?.textContent).toContain('Option 1')
  })

  it('A4: End scrolls the last option into view (maxScroll)', () => {
    const { container } = render(() => (
      <IrisSelect items={makeItems(10_000)} virtual portalTarget={false} />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    fireEvent.keyDown(trigger, { key: 'End' })
    expect(listbox(container).scrollTop).toBe(359_760)
    expect(optionEls(container).some((o) => o.getAttribute('aria-posinset') === '10000')).toBe(true)
  })

  it('A4: wheel scroll drives the window — nav then re-scrolls', () => {
    const { container } = render(() => (
      <IrisSelect items={makeItems(10_000)} virtual portalTarget={false} />
    ))
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    const lb = listbox(container)
    lb.scrollTop = 1000
    fireEvent.scroll(lb)
    expect(posinsets(container)[0]).toBe(24) // floor((1000 − 4×36)/36) + 1
    const trigger = container.querySelector('[data-iris-select-trigger]')!
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(listbox(container).scrollTop).toBe(36)
  })

  it('A5: empty state with virtual — no options, no spacers', () => {
    const { container } = render(() => <IrisSelect items={[]} virtual portalTarget={false} />)
    fireEvent.click(container.querySelector('[data-iris-select-trigger]')!)
    expect(listbox(container)).not.toBeNull()
    expect(optionEls(container).length).toBe(0)
    expect(spacerEls(container).length).toBe(0)
    expect(container.querySelector('[data-iris-select-empty]')).not.toBeNull()
  })
})
