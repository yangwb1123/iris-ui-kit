import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCascader, type IrisCascaderNode } from './IrisCascader'

afterEach(cleanup)

const options = [
  {
    label: 'Fruits',
    value: 'fruits',
    children: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ],
  },
  {
    label: 'Vegetables',
    value: 'vegetables',
    children: [{ label: 'Carrot', value: 'carrot' }],
  },
]

function triggerEl(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-cascader-trigger]') as HTMLButtonElement
}
function dropdownEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-cascader-dropdown]')
}
function getOptions(container: HTMLElement, col: number = 0): HTMLElement[] {
  return Array.from(
    container.querySelectorAll(`[data-iris-cascader-column="${col}"] [data-iris-cascader-option]`),
  )
}

// Large fixtures for the opt-in virtual path (10k options per column).
const BIG: IrisCascaderNode[] = Array.from({ length: 10_000 }, (_, i) => ({
  label: `O${i}`,
  value: `v${i}`,
}))
const DEEP: IrisCascaderNode[] = [{ label: 'root', value: 'r', children: BIG }]

describe('IrisCascader', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    expect(container.querySelector('[data-iris-cascader]')).not.toBeNull()
  })

  it('opens dropdown on trigger click', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    expect(dropdownEl(container)).toBeNull()
    fireEvent.click(triggerEl(container))
    expect(dropdownEl(container)).not.toBeNull()
  })

  it('trigger has aria-haspopup=listbox and opens on ArrowDown / closes on Escape', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    const trigger = triggerEl(container)
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(dropdownEl(container)).not.toBeNull()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(dropdownEl(container)).toBeNull()
  })

  it('shows first level options when open', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    fireEvent.click(triggerEl(container))
    const opts = getOptions(container, 0)
    expect(opts.length).toBeGreaterThanOrEqual(2)
    expect(opts[0]?.textContent).toContain('Fruits')
  })

  it('calls onChange when leaf selected', () => {
    const onChange = vi.fn()
    const leafOptions = [{ label: 'Direct', value: 'direct' }]
    const { container } = render(() => <IrisCascader options={leafOptions} onChange={onChange} />)
    fireEvent.click(triggerEl(container))
    const opt = container.querySelector('[data-iris-cascader-option="direct"]') as HTMLElement
    fireEvent.click(opt)
    expect(onChange).toHaveBeenCalledWith(['direct'])
  })

  describe('ARIA attributes', () => {
    it('has aria-expanded on trigger', () => {
      const { container } = render(() => <IrisCascader options={options} />)
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(trigger)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })

    it('has aria-invalid when invalid', () => {
      const { container } = render(() => <IrisCascader options={options} invalid />)
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('aria-invalid')).toBe('true')
    })

    it('has data-state open/closed', () => {
      const { container } = render(() => <IrisCascader options={options} />)
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('data-state')).toBe('closed')
      fireEvent.click(trigger)
      expect(trigger.getAttribute('data-state')).toBe('open')
    })
  })

  describe('multi-level navigation', () => {
    it('opens second column when clicking a parent option', () => {
      const { container } = render(() => <IrisCascader options={options} />)
      fireEvent.click(triggerEl(container))
      // Click "Fruits" parent
      const fruits = container.querySelector('[data-iris-cascader-option="fruits"]') as HTMLElement
      fireEvent.click(fruits)
      // Second column should appear with children
      const col2Options = getOptions(container, 1)
      expect(col2Options.length).toBe(2) // Apple, Banana
      expect(col2Options[0]?.textContent).toContain('Apple')
    })

    it('selects a deep leaf node', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisCascader options={options} onChange={onChange} />)
      fireEvent.click(triggerEl(container))
      // Navigate to second level
      const fruits = container.querySelector('[data-iris-cascader-option="fruits"]') as HTMLElement
      fireEvent.click(fruits)
      // Select Apple
      const apple = container.querySelector('[data-iris-cascader-option="apple"]') as HTMLElement
      fireEvent.click(apple)
      expect(onChange).toHaveBeenCalledWith(['fruits', 'apple'])
    })
  })

  describe('controlled mode', () => {
    it('displays the selected label on the trigger', () => {
      const { container } = render(() => (
        <IrisCascader options={options} value={['vegetables', 'carrot']} />
      ))
      const trigger = triggerEl(container)
      expect(trigger.textContent).toContain('Carrot')
    })
  })

  describe('states', () => {
    it('disables the trigger when disabled', () => {
      const { container } = render(() => <IrisCascader options={options} disabled />)
      expect(triggerEl(container).hasAttribute('disabled')).toBe(true)
    })

    it('sets data-disabled on container', () => {
      const { container } = render(() => <IrisCascader options={options} disabled />)
      const el = container.querySelector('[data-iris-cascader]')
      expect(el?.getAttribute('data-disabled')).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles empty options', () => {
      const { container } = render(() => <IrisCascader options={[]} />)
      fireEvent.click(triggerEl(container))
      // Should not crash with empty options
      expect(dropdownEl(container)).not.toBeNull()
    })

    it('does not crash with no options prop', () => {
      const { container } = render(() => <IrisCascader />)
      expect(container.querySelector('[data-iris-cascader]')).not.toBeNull()
    })
  })

  describe('virtual prop (opt-in windowing)', () => {
    it('windows a large column instead of rendering every option (bounded DOM)', () => {
      const { container } = render(() => <IrisCascader options={BIG} virtual />)
      fireEvent.click(triggerEl(container))
      // jsdom collapses clientHeight to 0 after measure — the bound holds in
      // every phase (12 seeded / 4 collapsed options).
      expect(container.querySelectorAll('[data-iris-cascader-option]').length).toBeLessThanOrEqual(
        20,
      )
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
        const { container } = render(() => <IrisCascader options={BIG} virtual />)
        fireEvent.click(triggerEl(container))
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
        fireEvent.scroll(scroller)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        expect(firstIndex()).toBeGreaterThanOrEqual(40)
      } finally {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', descriptor)
        else delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight
      }
    })

    it('deep path: windowed columns stay clickable after scrolling', async () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisCascader options={DEEP} virtual onChange={onChange} />
      ))
      fireEvent.click(triggerEl(container))
      const root = container.querySelector('[data-iris-cascader-option="r"]') as HTMLElement
      fireEvent.click(root)
      const scrollers = container.querySelectorAll('[data-iris-virtual-scroll]')
      expect(scrollers.length).toBe(2) // one virtualizer per open column
      const scroller = scrollers[1] as HTMLElement
      Object.defineProperty(scroller, 'scrollTop', {
        value: 9999 * 34,
        writable: true,
        configurable: true,
      })
      fireEvent.scroll(scroller)
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      const leaf = container.querySelector('[data-iris-cascader-option="v9999"]') as HTMLElement
      expect(leaf).not.toBeNull()
      fireEvent.click(leaf)
      expect(onChange).toHaveBeenCalledWith(['r', 'v9999'])
      expect(dropdownEl(container)).toBeNull()
    })

    it('default-off renders every option (no virtualizer in DOM)', () => {
      const { container } = render(() => <IrisCascader options={BIG} />)
      fireEvent.click(triggerEl(container))
      expect(container.querySelectorAll('[data-iris-cascader-option]').length).toBe(10_000)
      expect(container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    })

    it('a11y parity: virtual container carries the same surface as the plain listbox', () => {
      const small: IrisCascaderNode[] = [
        { label: 'A', value: 'a', children: [{ label: 'A1', value: 'a1' }] },
        { label: 'B', value: 'b' },
      ]
      const plain = render(() => <IrisCascader options={small} />)
      fireEvent.click(triggerEl(plain.container))
      const plainCol = plain.container.querySelector('[data-iris-cascader-column="0"]')!
      const plainOpt = plainCol.querySelector('[data-iris-cascader-option]')!
      expect(plainCol.getAttribute('role')).toBe('listbox')
      expect(plainOpt.getAttribute('role')).toBe('option')
      expect(plainOpt.getAttribute('aria-selected')).toBe('false')
      cleanup()
      const virt = render(() => <IrisCascader options={small} virtual />)
      fireEvent.click(triggerEl(virt.container))
      const virtCol = virt.container.querySelector('[data-iris-cascader-column="0"]')!
      const virtOpt = virtCol.querySelector('[data-iris-cascader-option]')!
      expect(virtCol.getAttribute('role')).toBe('listbox')
      expect(virtOpt.getAttribute('role')).toBe('option')
      expect(virtOpt.getAttribute('aria-selected')).toBe('false')
    })

    it('virtual with empty options renders the dropdown without crashing', () => {
      const { container } = render(() => <IrisCascader options={[]} virtual />)
      fireEvent.click(triggerEl(container))
      expect(dropdownEl(container)).not.toBeNull()
      expect(container.querySelectorAll('[data-iris-cascader-column]').length).toBe(1)
      expect(container.querySelectorAll('[data-iris-cascader-option]').length).toBe(0)
    })
  })
})
