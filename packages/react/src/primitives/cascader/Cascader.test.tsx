import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCascader, type IrisCascaderNode } from './Cascader'

afterEach(() => cleanup())

const OPTIONS: IrisCascaderNode[] = [
  {
    label: 'Zhejiang',
    value: 'zj',
    children: [{ label: 'Hangzhou', value: 'hz', children: [{ label: 'West Lake', value: 'wl' }] }],
  },
  { label: 'Jiangsu', value: 'js', children: [{ label: 'Nanjing', value: 'nj' }] },
]

const trigger = (c: HTMLElement) => c.querySelector('[data-iris-cascader-trigger]') as HTMLElement
const columns = (c: HTMLElement) => c.querySelectorAll('[data-iris-cascader-column]')
const panel = (c: HTMLElement) => c.querySelector('[data-iris-cascader-panel]')
const valueEl = (c: HTMLElement) => c.querySelector('[data-iris-cascader-value]')

// Large fixtures for the opt-in virtual path (10k options per column).
const BIG: IrisCascaderNode[] = Array.from({ length: 10_000 }, (_, i) => ({
  label: `O${i}`,
  value: `v${i}`,
}))
const DEEP: IrisCascaderNode[] = [{ label: 'root', value: 'r', children: BIG }]

describe('@iris-ui-kit/react IrisCascader', () => {
  it('shows the placeholder, closed initially', () => {
    const { container } = render(<IrisCascader options={OPTIONS} placeholder="Pick" />)
    expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
    expect(container.querySelector('[data-iris-cascader-value]')?.textContent).toBe('Pick')
  })

  it('opens to the root column', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    expect(columns(container).length).toBe(1)
    expect(columns(container)[0].querySelectorAll('[data-iris-cascader-option]').length).toBe(2)
  })

  it('clicking a branch reveals the next column', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-iris-cascader-option][data-value="zj"]')!)
    expect(columns(container).length).toBe(2)
    expect(container.querySelector('[data-value="hz"]')).not.toBeNull()
  })

  it('clicking a leaf commits the path and closes', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisCascader options={OPTIONS} onValueChange={onValueChange} />)
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-value="js"]')!)
    fireEvent.click(container.querySelector('[data-value="nj"]')!)
    expect(onValueChange).toHaveBeenCalledWith(['js', 'nj'])
    expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
  })

  it('renders the selected path in the trigger', () => {
    const { container } = render(<IrisCascader options={OPTIONS} value={['zj', 'hz', 'wl']} />)
    expect(container.querySelector('[data-iris-cascader-value]')?.textContent).toBe(
      'Zhejiang / Hangzhou / West Lake',
    )
  })

  it('a11y: trigger haspopup + expanded toggles', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    const t = trigger(container)
    expect(t.getAttribute('aria-haspopup')).toBe('listbox')
    expect(t.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(t)
    expect(t.getAttribute('aria-expanded')).toBe('true')
  })

  it('disabled trigger has disabled attribute', () => {
    const { container } = render(<IrisCascader options={OPTIONS} disabled />)
    expect(trigger(container).hasAttribute('disabled')).toBe(true)
  })

  it('Escape closes the panel', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    expect(container.querySelector('[data-iris-cascader-panel]')).not.toBeNull()
    fireEvent.keyDown(trigger(container), { key: 'Escape' })
    expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
  })

  it('custom separator renders in trigger value', () => {
    const { container } = render(
      <IrisCascader options={OPTIONS} value={['zj', 'hz']} separator=" > " />,
    )
    expect(valueEl(container)?.textContent).toBe('Zhejiang > Hangzhou')
  })

  it('data-state transitions open/closed', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    const root = container.querySelector('[data-iris-cascader]')
    expect(root?.getAttribute('data-state')).toBe('closed')
    fireEvent.click(trigger(container))
    expect(root?.getAttribute('data-state')).toBe('open')
    fireEvent.keyDown(trigger(container), { key: 'Escape' })
    expect(root?.getAttribute('data-state')).toBe('closed')
  })

  it('aria-invalid when invalid', () => {
    const { container } = render(<IrisCascader options={OPTIONS} invalid />)
    expect(trigger(container).getAttribute('aria-invalid')).toBe('true')
  })

  it('ArrowDown opens the panel when closed', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    expect(panel(container)).toBeNull()
    fireEvent.keyDown(trigger(container), { key: 'ArrowDown' })
    expect(panel(container)).not.toBeNull()
  })

  it('updates value display after selection', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    fireEvent.click(container.querySelector('[data-value="js"]')!)
    fireEvent.click(container.querySelector('[data-value="nj"]')!)
    expect(valueEl(container)?.textContent).toBe('Jiangsu / Nanjing')
  })

  it('shows multiple cascading columns for deep trees', () => {
    const { container } = render(<IrisCascader options={OPTIONS} />)
    fireEvent.click(trigger(container))
    // Click Zhejiang → see second column
    fireEvent.click(container.querySelector('[data-value="zj"]')!)
    expect(columns(container).length).toBe(2)
    // Click Hangzhou → see third column
    fireEvent.click(container.querySelector('[data-value="hz"]')!)
    expect(columns(container).length).toBe(3)
    expect(container.querySelector('[data-value="wl"]')).not.toBeNull()
  })

  it('handles empty options', () => {
    const { container } = render(<IrisCascader options={[]} />)
    fireEvent.click(trigger(container))
    // Should not crash
    expect(panel(container)).not.toBeNull()
  })

  describe('virtual prop (opt-in windowing)', () => {
    it('windows a large column instead of rendering every option (bounded DOM)', () => {
      const { container } = render(<IrisCascader options={BIG} virtual />)
      fireEvent.click(trigger(container))
      // jsdom collapses clientHeight to 0 after measure, so the rendered window
      // is 12 (seed) or 4 (collapsed) options — the bound holds in every phase.
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
        const { container } = render(<IrisCascader options={BIG} virtual />)
        fireEvent.click(trigger(container))
        const scroller = container.querySelector('[data-iris-virtual-scroll]') as HTMLElement
        const firstIndex = () =>
          Number(
            scroller
              .querySelector('[data-iris-virtual-index]')
              ?.getAttribute('data-iris-virtual-index'),
          )
        expect(firstIndex()).toBe(0)
        act(() => {
          scroller.scrollTop = 1700 // 34 × 50
          fireEvent.scroll(scroller)
        })
        await act(async () => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        })
        expect(firstIndex()).toBeGreaterThanOrEqual(40)
      } finally {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', descriptor)
        else delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight
      }
    })

    it('deep path: windowed columns stay clickable after scrolling', async () => {
      const onValueChange = vi.fn()
      const { container } = render(
        <IrisCascader options={DEEP} virtual onValueChange={onValueChange} />,
      )
      fireEvent.click(trigger(container))
      fireEvent.click(container.querySelector('[data-value="r"]')!)
      const scrollers = container.querySelectorAll('[data-iris-virtual-scroll]')
      expect(scrollers.length).toBe(2) // one virtualizer per open column
      const scroller = scrollers[1] as HTMLElement
      act(() => {
        scroller.scrollTop = 9999 * 34
        fireEvent.scroll(scroller)
      })
      await act(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      })
      const leaf = container.querySelector('[data-value="v9999"]') as HTMLElement
      expect(leaf).not.toBeNull()
      fireEvent.click(leaf)
      expect(onValueChange).toHaveBeenCalledWith(['r', 'v9999'])
      expect(container.querySelector('[data-iris-cascader-panel]')).toBeNull()
    })

    it('default-off renders every option (no virtualizer in DOM)', () => {
      const { container } = render(<IrisCascader options={BIG} />)
      fireEvent.click(trigger(container))
      expect(container.querySelectorAll('[data-iris-cascader-option]').length).toBe(10_000)
      expect(container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    })

    it('a11y parity: virtual container carries the same surface as the plain listbox', () => {
      const small: IrisCascaderNode[] = [
        { label: 'A', value: 'a', children: [{ label: 'A1', value: 'a1' }] },
        { label: 'B', value: 'b' },
      ]
      const plain = render(<IrisCascader options={small} />)
      fireEvent.click(trigger(plain.container))
      const plainCol = plain.container.querySelector('[data-iris-cascader-column]')!
      const plainOpt = plainCol.querySelector('[data-iris-cascader-option]')!
      expect(plainCol.getAttribute('role')).toBe('listbox')
      expect(plainCol.getAttribute('data-level')).toBe('0')
      expect(plainOpt.getAttribute('role')).toBe('option')
      expect(plainOpt.getAttribute('aria-selected')).toBe('false')
      cleanup()
      const virt = render(<IrisCascader options={small} virtual />)
      fireEvent.click(trigger(virt.container))
      const virtCol = virt.container.querySelector('[data-iris-cascader-column]')!
      const virtOpt = virtCol.querySelector('[data-iris-cascader-option]')!
      expect(virtCol.getAttribute('role')).toBe('listbox')
      expect(virtCol.getAttribute('data-level')).toBe('0')
      expect(virtOpt.getAttribute('role')).toBe('option')
      expect(virtOpt.getAttribute('aria-selected')).toBe('false')
    })

    it('virtual with empty options renders the panel without crashing', () => {
      const { container } = render(<IrisCascader options={[]} virtual />)
      fireEvent.click(trigger(container))
      expect(panel(container)).not.toBeNull()
      expect(columns(container).length).toBe(1)
      expect(container.querySelectorAll('[data-iris-cascader-option]').length).toBe(0)
    })
  })
})
