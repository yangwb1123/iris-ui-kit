import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCombobox, type IrisComboboxOption } from './Combobox'

afterEach(() => cleanup())

const OPTIONS: IrisComboboxOption[] = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

const input = (c: HTMLElement) => c.querySelector('[data-iris-combobox-input]') as HTMLInputElement
const opts = (c: HTMLElement) => c.querySelectorAll('[data-iris-combobox-option]')
const listbox = (c: HTMLElement) => c.querySelector('[role="listbox"]') as HTMLUListElement
const spacers = (c: HTMLElement) => c.querySelectorAll('[data-iris-combobox-spacer]')
const makeOptions = (n: number): IrisComboboxOption[] =>
  Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))

describe('@iris-ui-kit/react IrisCombobox', () => {
  it('renders a combobox input, closed initially', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    const el = input(container)
    expect(el.getAttribute('role')).toBe('combobox')
    expect(el.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on focus and lists all options', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    expect(input(container).getAttribute('aria-expanded')).toBe('true')
    expect(opts(container).length).toBe(3)
  })

  it('filters options as you type', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    fireEvent.change(input(container), { target: { value: 'Ba' } })
    expect(opts(container).length).toBe(1)
    expect(opts(container)[0].textContent).toBe('Banana')
  })

  it('clicking an option selects it and shows its label', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisCombobox options={OPTIONS} onValueChange={onValueChange} />)
    fireEvent.focus(input(container))
    fireEvent.click(opts(container)[1])
    expect(onValueChange).toHaveBeenCalledWith('banana')
    expect(input(container).value).toBe('Banana')
  })

  it('keyboard: ArrowDown + Enter selects the active option', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisCombobox options={OPTIONS} onValueChange={onValueChange} />)
    const el = input(container)
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    fireEvent.keyDown(el, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith('banana')
  })

  it('Escape closes the listbox', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    expect(input(container).getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(input(container), { key: 'Escape' })
    expect(input(container).getAttribute('aria-expanded')).toBe('false')
  })

  it('shows empty text when nothing matches', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    fireEvent.change(input(container), { target: { value: 'zzz' } })
    expect(opts(container).length).toBe(0)
    expect(container.querySelector('[data-iris-combobox-empty]')!.textContent).toBe(
      'No matching results',
    )
  })

  it('reflects the selected value as the input text (controlled)', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} value="cherry" />)
    expect(input(container).value).toBe('Cherry')
  })

  it('marks the selected option with aria-selected', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} value="banana" />)
    fireEvent.focus(input(container))
    const selected = Array.from(opts(container)).find(
      (o) => o.getAttribute('aria-selected') === 'true',
    )
    expect(selected?.textContent).toBe('Banana')
  })

  it('disabled does not open', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} disabled />)
    fireEvent.focus(input(container))
    expect(input(container).getAttribute('aria-expanded')).toBe('false')
  })

  it('a11y: aria-controls points at the listbox; activedescendant tracks the active option', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} id="cb" />)
    const el = input(container)
    expect(el.id).toBe('cb')
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'ArrowDown' })
    const listbox = container.querySelector('[role="listbox"]') as HTMLElement
    expect(listbox.id).toBe(el.getAttribute('aria-controls'))
    expect(el.getAttribute('aria-activedescendant')).toBeTruthy()
  })
})

describe('IrisCombobox virtual listbox', () => {
  it('A1: virtual off (omitted) — all options rendered, no spacers, no new DOM', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} />)
    fireEvent.focus(input(container))
    expect(opts(container).length).toBe(3)
    expect(spacers(container).length).toBe(0)
    expect(opts(container)[0]!.id).toMatch(/-opt-0$/)
  })

  it('A1: virtual={false} explicit — identical to the default path', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} virtual={false} />)
    fireEvent.focus(input(container))
    expect(opts(container).length).toBe(3)
    expect(spacers(container).length).toBe(0)
  })

  it('A1: small list with virtual — total window, spacer sum invariant', () => {
    const { container } = render(<IrisCombobox options={OPTIONS} virtual />)
    fireEvent.focus(input(container))
    expect(opts(container).length).toBe(3)
    const sp = spacers(container)
    expect(sp.length).toBe(2)
    const top = sp[0] as HTMLElement
    const bottom = sp[1] as HTMLElement
    expect(top.getAttribute('data-iris-combobox-spacer-type')).toBe('top')
    expect(bottom.getAttribute('data-iris-combobox-spacer-type')).toBe('bottom')
    expect(parseFloat(top.style.height)).toBe(0)
    expect(parseFloat(bottom.style.height)).toBe(0)
    expect(
      parseFloat(top.style.height) + opts(container).length * 34 + parseFloat(bottom.style.height),
    ).toBe(3 * 34)
    // windowed options carry ARIA virtual-list positions
    expect(opts(container)[0]!.getAttribute('aria-setsize')).toBe('3')
    expect(opts(container)[0]!.getAttribute('aria-posinset')).toBe('1')
  })

  it('A2: 10k options — only the window (+ buffer) is rendered', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    fireEvent.focus(input(container))
    const rendered = opts(container)
    expect(rendered.length).toBeGreaterThanOrEqual(1)
    expect(rendered.length).toBeLessThanOrEqual(50)
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
      parseFloat(top.style.height) + rendered.length * 34 + parseFloat(bottom.style.height),
    ).toBe(10_000 * 34)
  })

  it('A3: End scrolls the last option into view (scrollTop === maxScroll)', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    const el = input(container)
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'End' })
    expect(el.getAttribute('aria-activedescendant')).toMatch(/-opt-9999$/)
    const active = document.getElementById(el.getAttribute('aria-activedescendant')!)
    expect(active).not.toBeNull()
    expect(active!.getAttribute('role')).toBe('option')
    expect(listbox(container).scrollTop).toBe(339_760)
  })

  it('A3: ArrowUp after End is a no-op (already fully visible)', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    const el = input(container)
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'End' })
    fireEvent.keyDown(el, { key: 'ArrowUp' })
    expect(el.getAttribute('aria-activedescendant')).toMatch(/-opt-9998$/)
    expect(listbox(container).scrollTop).toBe(339_760)
  })

  it('A3: ArrowDown across the window edge re-windows (scrollTop === 66)', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    const el = input(container)
    fireEvent.focus(el)
    for (let i = 0; i < 9; i++) fireEvent.keyDown(el, { key: 'ArrowDown' })
    expect(el.getAttribute('aria-activedescendant')).toMatch(/-opt-8$/)
    const active = document.getElementById(el.getAttribute('aria-activedescendant')!)
    expect(active).not.toBeNull()
    expect(listbox(container).scrollTop).toBe(66)
  })

  it('A3: Home scrolls back to the top', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    const el = input(container)
    fireEvent.focus(el)
    fireEvent.keyDown(el, { key: 'End' })
    fireEvent.keyDown(el, { key: 'Home' })
    expect(el.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    expect(listbox(container).scrollTop).toBe(0)
  })

  it('A3: wheel scroll drives setScroll — window follows the offset', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    fireEvent.focus(input(container))
    const lb = listbox(container)
    lb.scrollTop = 1000
    fireEvent.scroll(lb)
    const rendered = opts(container)
    expect(rendered.length).toBeLessThanOrEqual(50)
    expect(rendered[0]!.id).toMatch(/-opt-25$/)
  })

  it('A4: filtering re-windows; count shrink clamps scroll to 0', () => {
    const mixed = [
      ...makeOptions(9_997),
      ...makeOptions(3).map((o, i) => ({ ...o, label: `target-${i}`, value: `target-${i}` })),
    ]
    const { container } = render(<IrisCombobox options={mixed} virtual />)
    const el = input(container)
    fireEvent.focus(el)
    const lb = listbox(container)
    lb.scrollTop = 5000
    fireEvent.scroll(lb)
    fireEvent.change(el, { target: { value: 'target' } })
    const rendered = opts(container)
    expect(rendered.length).toBe(3)
    expect(rendered[0]!.id).toMatch(/-opt-0$/)
    expect(rendered[2]!.id).toMatch(/-opt-2$/)
    expect(Array.from(rendered).map((o) => o.textContent)).toEqual([
      'target-0',
      'target-1',
      'target-2',
    ])
    expect(el.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    const sp = spacers(container)
    expect(parseFloat((sp[0] as HTMLElement).style.height)).toBe(0)
    expect(parseFloat((sp[1] as HTMLElement).style.height)).toBe(0)
    expect(lb.scrollTop).toBe(0)
  })

  it('A4: filter to zero matches — empty state, no spacers, no activedescendant', () => {
    const { container } = render(<IrisCombobox options={makeOptions(10_000)} virtual />)
    const el = input(container)
    fireEvent.focus(el)
    fireEvent.change(el, { target: { value: 'zzz' } })
    expect(opts(container).length).toBe(0)
    expect(spacers(container).length).toBe(0)
    expect(container.querySelector('[data-iris-combobox-empty]')).not.toBeNull()
    expect(el.getAttribute('aria-activedescendant')).toBeNull()
  })
})
