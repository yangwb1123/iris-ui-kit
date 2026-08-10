import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisCombobox from './IrisCombobox.svelte'

afterEach(cleanup)

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

async function openListbox(container: HTMLElement): Promise<HTMLInputElement> {
  const input = container.querySelector('input') as HTMLInputElement
  await fireEvent.focus(input)
  return input
}

async function getOptions(container: HTMLElement): Promise<HTMLElement[]> {
  return Array.from(container.querySelectorAll('[data-iris-combobox-option]'))
}
function getSpacers(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-combobox-spacer]'))
}
function makeOptions(n: number): { label: string; value: string }[] {
  return Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: `item-${i}` }))
}

describe('IrisCombobox', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisCombobox, { props: { options } })
    expect(container).toBeTruthy()
  })

  it('has aria attributes on the input', () => {
    const { container } = render(IrisCombobox, { props: { options } })
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
  })

  it('opens on focus', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    await openListbox(container)
    expect(container.querySelector('[data-iris-combobox]')?.getAttribute('data-state')).toBe('open')
    expect(container.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('shows all options on open', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    await openListbox(container)
    const opts = await getOptions(container)
    expect(opts.length).toBe(3)
  })

  it('filters options on input', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    const input = await openListbox(container)
    await fireEvent.input(input, { target: { value: 'ban' } })
    const opts = await getOptions(container)
    expect(opts.length).toBe(1)
    expect(opts[0]?.textContent?.trim()).toBe('Banana')
  })

  it('calls onValueChange on option click', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisCombobox, { props: { options, onValueChange } })
    await openListbox(container)
    const opts = await getOptions(container)
    await fireEvent.click(opts[0]!)
    expect(onValueChange).toHaveBeenCalledWith('apple')
  })

  it('closes on Escape', async () => {
    const { container } = render(IrisCombobox, { props: { options } })
    const input = await openListbox(container)
    expect(container.querySelector('[data-iris-combobox]')?.getAttribute('data-state')).toBe('open')
    await fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('[data-iris-combobox]')?.getAttribute('data-state')).toBe(
      'closed',
    )
  })

  describe('controlled mode', () => {
    it('shows selected value label', () => {
      const { container } = render(IrisCombobox, { props: { options, value: 'banana' } })
      const input = container.querySelector('input') as HTMLInputElement
      expect(input.value).toBe('Banana')
    })
  })

  describe('states', () => {
    it('disables the input when disabled', () => {
      const { container } = render(IrisCombobox, { props: { options, disabled: true } })
      const input = container.querySelector('input') as HTMLInputElement
      expect(input.disabled).toBe(true)
    })

    it('sets aria-invalid when invalid', () => {
      const { container } = render(IrisCombobox, { props: { options, invalid: true } })
      const input = container.querySelector('input') as HTMLInputElement
      expect(input.getAttribute('aria-invalid')).toBe('true')
    })

    it('sets aria-expanded when open and closed', async () => {
      const { container } = render(IrisCombobox, { props: { options } })
      const input = container.querySelector('input') as HTMLInputElement
      expect(input.getAttribute('aria-expanded')).toBe('false')
      await fireEvent.focus(input)
      expect(input.getAttribute('aria-expanded')).toBe('true')
    })

    it('shows empty text when no match', async () => {
      const { container } = render(IrisCombobox, {
        props: { options, emptyText: 'No results' },
      })
      const input = await openListbox(container)
      await fireEvent.input(input, { target: { value: 'zebra' } })
      const opts = await getOptions(container)
      expect(opts.length).toBe(0)
    })
  })

  describe('keyboard navigation', () => {
    it('opens listbox on ArrowDown', async () => {
      const { container } = render(IrisCombobox, { props: { options } })
      const input = container.querySelector('input') as HTMLInputElement
      await fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(container.querySelector('[role="listbox"]')).not.toBeNull()
      expect(input.getAttribute('aria-expanded')).toBe('true')
    })

    it('navigates with ArrowDown/ArrowUp and sets aria-activedescendant', async () => {
      const { container } = render(IrisCombobox, { props: { options } })
      const input = await openListbox(container)

      await fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)

      await fireEvent.keyDown(input, { key: 'ArrowDown' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-1$/)

      await fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    })

    it('selects active option on Enter', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisCombobox, { props: { options, onValueChange } })
      const input = await openListbox(container)
      await fireEvent.keyDown(input, { key: 'ArrowDown' }) // activate first
      await fireEvent.keyDown(input, { key: 'Enter' })
      expect(onValueChange).toHaveBeenCalledWith('apple')
    })

    it('Home jumps to first option, End to last', async () => {
      const { container } = render(IrisCombobox, { props: { options } })
      const input = await openListbox(container)
      await fireEvent.keyDown(input, { key: 'End' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-2$/)
      await fireEvent.keyDown(input, { key: 'Home' })
      expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-0$/)
    })
  })

  describe('edge cases', () => {
    it('handles empty options array', async () => {
      const { container } = render(IrisCombobox, { props: { options: [] } })
      await openListbox(container)
      // No crash with empty options
      expect(container.querySelector('[data-iris-combobox]')).not.toBeNull()
    })

    it('does not call onValueChange on Enter when no active option', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisCombobox, { props: { options, onValueChange } })
      const input = container.querySelector('input') as HTMLInputElement
      // Enter without opening should not emit
      await fireEvent.keyDown(input, { key: 'Enter' })
      expect(onValueChange).not.toHaveBeenCalled()
    })
    describe('virtual listbox', () => {
      it('A1: virtual off (default) — all options, no spacers', async () => {
        const { container } = render(IrisCombobox, { props: { options } })
        await openListbox(container)
        expect((await getOptions(container)).length).toBe(3)
        expect(getSpacers(container).length).toBe(0)
      })

      it('A1: small list with virtual — total window, spacer sum invariant', async () => {
        const { container } = render(IrisCombobox, { props: { options, virtual: true } })
        await openListbox(container)
        const rendered = await getOptions(container)
        expect(rendered.length).toBe(3)
        const sp = getSpacers(container)
        expect(sp.length).toBe(2)
        expect(sp[0]!.getAttribute('data-iris-combobox-spacer-type')).toBe('top')
        expect(sp[1]!.getAttribute('data-iris-combobox-spacer-type')).toBe('bottom')
        expect(
          parseFloat(sp[0]!.style.height) + rendered.length * 34 + parseFloat(sp[1]!.style.height),
        ).toBe(3 * 34)
        expect(rendered[0]!.getAttribute('aria-setsize')).toBe('3')
        expect(rendered[0]!.getAttribute('aria-posinset')).toBe('1')
      })

      it('A2 smoke: 10k options — windowed render with spacer invariant', async () => {
        const { container } = render(IrisCombobox, {
          props: { options: makeOptions(10_000), virtual: true },
        })
        await openListbox(container)
        const rendered = await getOptions(container)
        expect(rendered.length).toBeGreaterThanOrEqual(1)
        expect(rendered.length).toBeLessThanOrEqual(50)
        expect(rendered[0]!.id).toMatch(/-opt-0$/)
        const sp = getSpacers(container)
        expect(parseFloat(sp[0]!.style.height)).toBe(0)
        expect(
          parseFloat(sp[0]!.style.height) + rendered.length * 34 + parseFloat(sp[1]!.style.height),
        ).toBe(10_000 * 34)
      })

      it('A3 smoke: End scrolls the last option into view (maxScroll)', async () => {
        const { container } = render(IrisCombobox, {
          props: { options: makeOptions(10_000), virtual: true },
        })
        const input = await openListbox(container)
        await fireEvent.keyDown(input, { key: 'End' })
        expect(input.getAttribute('aria-activedescendant')).toMatch(/-opt-9999$/)
        const lb = container.querySelector('[role="listbox"]') as HTMLElement
        expect(lb.scrollTop).toBe(339_760)
        const rendered = await getOptions(container)
        expect(rendered.some((o) => o.id.endsWith('-opt-9999'))).toBe(true)
      })
    })
  })
})
