import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisCascader from './IrisCascader.svelte'

const options = [
  {
    label: 'Animals',
    value: 'animals',
    children: [
      { label: 'Dog', value: 'dog' },
      { label: 'Cat', value: 'cat' },
    ],
  },
  { label: 'Plants', value: 'plants', children: [{ label: 'Rose', value: 'rose' }] },
]

async function openDropdown(container: HTMLElement): Promise<HTMLElement> {
  const trigger = container.querySelector('[data-iris-cascader-trigger]')! as HTMLElement
  await fireEvent.click(trigger)
  flushSync()
  return trigger
}

function triggerEl(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-cascader-trigger]')! as HTMLElement
}
function dropdownEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-cascader-dropdown]')
}
function items(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-cascader-item]'))
}

// Large fixtures for the opt-in virtual path (10k options per column).
const BIG = Array.from({ length: 10_000 }, (_, i) => ({ label: `O${i}`, value: `v${i}` }))
const DEEP = [{ label: 'root', value: 'r', children: BIG }]

describe('IrisCascader (svelte)', () => {
  it('renders a trigger button', () => {
    const { container } = render(IrisCascader, { props: { options } })
    expect(triggerEl(container)).toBeTruthy()
  })

  it('opens dropdown on click', async () => {
    const { container } = render(IrisCascader, { props: { options } })
    expect(dropdownEl(container)).toBeFalsy()
    await openDropdown(container)
    expect(dropdownEl(container)).toBeTruthy()
  })

  it('opens on ArrowDown and closes on Escape from the trigger', async () => {
    const { container } = render(IrisCascader, { props: { options } })
    const trigger = triggerEl(container)
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    flushSync()
    expect(dropdownEl(container)).toBeTruthy()
    await fireEvent.keyDown(trigger, { key: 'Escape' })
    flushSync()
    expect(dropdownEl(container)).toBeFalsy()
  })

  it('expands children on parent click', async () => {
    let changed: string[] | null = null
    const { container } = render(IrisCascader, {
      props: {
        options,
        onValueChange: (p: string[]) => {
          changed = p
        },
      },
    })
    await openDropdown(container)
    const allItems = items(container)
    await fireEvent.click(allItems[0]!) // click 'Animals'
    flushSync()
    const cols = container.querySelectorAll('[role="listbox"]')
    expect(cols.length).toBe(2)
    expect(changed).toBeFalsy()
  })

  describe('ARIA attributes', () => {
    it('has data-state on trigger', async () => {
      const { container } = render(IrisCascader, { props: { options } })
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('data-state')).toBe('closed')
      await openDropdown(container)
      expect(trigger.getAttribute('data-state')).toBe('open')
    })

    it('sets aria-expanded on trigger', async () => {
      const { container } = render(IrisCascader, { props: { options } })
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      await openDropdown(container)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })

    it('has aria-invalid when invalid', () => {
      const { container } = render(IrisCascader, { props: { options, invalid: true } })
      expect(triggerEl(container).getAttribute('aria-invalid')).toBe('true')
    })

    it('has data-disabled on container when disabled', () => {
      const { container } = render(IrisCascader, { props: { options, disabled: true } })
      const root = container.querySelector('[data-iris-cascader]')
      expect(root?.getAttribute('data-disabled')).toBe('')
    })
  })

  describe('selection', () => {
    it('selects a leaf node and emits onValueChange', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisCascader, {
        props: { options, onValueChange },
      })
      await openDropdown(container)
      // Click Plants → second column, then Rose
      const plants = items(container)[1]!
      await fireEvent.click(plants)
      flushSync()
      const secondCol = container.querySelectorAll('[role="listbox"]')
      expect(secondCol.length).toBe(2)
      const rose = secondCol[1]?.querySelector('[data-iris-cascader-item]') as HTMLElement
      await fireEvent.click(rose)
      flushSync()
      expect(onValueChange).toHaveBeenCalledWith(['plants', 'rose'])
    })

    it('shows selected path on trigger', () => {
      const { container } = render(IrisCascader, {
        props: { options, value: ['animals', 'dog'] },
      })
      expect(triggerEl(container).textContent).toContain('Dog')
    })

    it('uses a controlled path updated while closed when it next opens', async () => {
      const { container, rerender } = render(IrisCascader, {
        props: { options, value: ['animals', 'dog'] },
      })
      await rerender({ options, value: ['plants', 'rose'] })
      await openDropdown(container)
      const selected = Array.from(
        container.querySelectorAll<HTMLElement>('[data-iris-cascader-item][data-state="selected"]'),
      ).map((item) => item.textContent?.trim())
      expect(selected).toEqual(expect.arrayContaining(['Plants ›', 'Rose']))
    })
  })

  describe('disabled state', () => {
    it('disables the trigger when disabled', () => {
      const { container } = render(IrisCascader, { props: { options, disabled: true } })
      expect(triggerEl(container).hasAttribute('disabled')).toBe(true)
    })

    it('does not open dropdown when disabled and clicked', async () => {
      const { container } = render(IrisCascader, { props: { options, disabled: true } })
      await fireEvent.click(triggerEl(container))
      flushSync()
      expect(dropdownEl(container)).toBeFalsy()
    })
  })

  describe('edge cases', () => {
    it('handles empty options', async () => {
      const { container } = render(IrisCascader, { props: { options: [] } })
      await openDropdown(container)
      expect(dropdownEl(container)).toBeTruthy()
    })
  })

  describe('virtual prop (opt-in windowing)', () => {
    it('windows a large column instead of rendering every option (bounded DOM)', async () => {
      const { container } = render(IrisCascader, { props: { options: BIG, virtual: true } })
      await openDropdown(container)
      // The svelte bridge keeps the numeric viewport (240) when jsdom reports
      // clientHeight 0 — window is 12 options either way; the bound holds.
      expect(container.querySelectorAll('[data-iris-cascader-item]').length).toBeLessThanOrEqual(20)
      const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLElement
      expect(spacer.style.height).toBe('340000px') // 10_000 × 34
    })

    it('scrolling moves the window (clientHeight mocked)', async () => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => 240,
      })
      try {
        const { container } = render(IrisCascader, { props: { options: BIG, virtual: true } })
        await openDropdown(container)
        const scroller = container.querySelector('[data-iris-virtual-scroll]') as HTMLElement
        const firstIndex = () =>
          Number(
            scroller
              .querySelector('[data-iris-virtual-index]')
              ?.getAttribute('data-iris-virtual-index'),
          )
        expect(firstIndex()).toBe(0)
        Object.defineProperty(scroller, 'scrollTop', {
          value: 1700, // 34 × 50
          writable: true,
          configurable: true,
        })
        await fireEvent.scroll(scroller)
        await new Promise((r) => requestAnimationFrame(() => r()))
        flushSync()
        expect(firstIndex()).toBeGreaterThanOrEqual(40)
      } finally {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', descriptor)
        else delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight
      }
    })

    it('deep path: windowed columns stay clickable after scrolling', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisCascader, {
        props: { options: DEEP, virtual: true, onValueChange },
      })
      await openDropdown(container)
      await fireEvent.click(items(container)[0]!) // root
      flushSync()
      const scrollers = container.querySelectorAll('[data-iris-virtual-scroll]')
      expect(scrollers.length).toBe(2) // one virtualizer per open column
      const scroller = scrollers[1] as HTMLElement
      Object.defineProperty(scroller, 'scrollTop', {
        value: 9999 * 34,
        writable: true,
        configurable: true,
      })
      await fireEvent.scroll(scroller)
      await new Promise((r) => requestAnimationFrame(() => r()))
      flushSync()
      const leaf = Array.from(container.querySelectorAll('[data-iris-cascader-item]')).find(
        (el) => el.textContent?.trim() === 'O9999',
      ) as HTMLElement
      expect(leaf).toBeTruthy()
      await fireEvent.click(leaf)
      flushSync()
      expect(onValueChange).toHaveBeenCalledWith(['r', 'v9999'])
      expect(dropdownEl(container)).toBeFalsy()
    })

    it('default-off renders every option (no virtualizer in DOM)', async () => {
      const { container } = render(IrisCascader, { props: { options: BIG } })
      await openDropdown(container)
      expect(container.querySelectorAll('[data-iris-cascader-item]').length).toBe(10_000)
      expect(container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    }, 30_000)

    it('a11y parity: virtual container carries the same surface as the plain listbox', async () => {
      const small = [
        { label: 'A', value: 'a', children: [{ label: 'A1', value: 'a1' }] },
        { label: 'B', value: 'b' },
      ]
      const plain = render(IrisCascader, { props: { options: small } })
      await openDropdown(plain.container)
      const plainCol = plain.container.querySelector('[role="listbox"]')!
      const plainOpt = plainCol.querySelector('[data-iris-cascader-item]')!
      expect(plainCol.getAttribute('aria-label')).toBeTruthy()
      expect(plainOpt.getAttribute('role')).toBe('option')
      expect(plainOpt.getAttribute('aria-selected')).toBe('false')
      plain.unmount()
      const virt = render(IrisCascader, { props: { options: small, virtual: true } })
      await openDropdown(virt.container)
      const virtCol = virt.container.querySelector('[role="listbox"]')!
      const virtOpt = virtCol.querySelector('[data-iris-cascader-item]')!
      expect(virtCol.getAttribute('aria-label')).toBeTruthy()
      expect(virtOpt.getAttribute('role')).toBe('option')
      expect(virtOpt.getAttribute('aria-selected')).toBe('false')
    })

    it('virtual with empty options renders the dropdown without crashing', async () => {
      const { container } = render(IrisCascader, { props: { options: [], virtual: true } })
      await openDropdown(container)
      expect(dropdownEl(container)).toBeTruthy()
      expect(container.querySelectorAll('[role="listbox"]').length).toBe(1)
      expect(container.querySelectorAll('[data-iris-cascader-item]').length).toBe(0)
    })
  })
})
