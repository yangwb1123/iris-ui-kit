import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisCascader, type IrisCascaderNode } from './Cascader'

const OPTIONS: IrisCascaderNode[] = [
  {
    label: 'Zhejiang',
    value: 'zj',
    children: [{ label: 'Hangzhou', value: 'hz', children: [{ label: 'West Lake', value: 'wl' }] }],
  },
  { label: 'Jiangsu', value: 'js', children: [{ label: 'Nanjing', value: 'nj' }] },
]

const trigger = (w: ReturnType<typeof mount>) => w.find('[data-iris-cascader-trigger]')
const columns = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-cascader-column]')
const panel = (w: ReturnType<typeof mount>) => w.find('[data-iris-cascader-panel]')

// Large fixtures for the opt-in virtual path (10k options per column).
const BIG: IrisCascaderNode[] = Array.from({ length: 10_000 }, (_, i) => ({
  label: `O${i}`,
  value: `v${i}`,
}))
const DEEP: IrisCascaderNode[] = [{ label: 'root', value: 'r', children: BIG }]

describe('IrisCascader', () => {
  it('shows the placeholder, closed initially', () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS, placeholder: 'Pick' } })
    expect(w.find('[data-iris-cascader-panel]').exists()).toBe(false)
    expect(w.find('[data-iris-cascader-value]').text()).toBe('Pick')
  })

  it('opens to the root column', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    expect(columns(w).length).toBe(1)
    expect(columns(w)[0].findAll('[data-iris-cascader-option]').length).toBe(2)
  })

  it('clicking a branch reveals the next column', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    await w.find('[data-iris-cascader-option][data-value="zj"]').trigger('click')
    expect(columns(w).length).toBe(2)
    expect(w.find('[data-value="hz"]').exists()).toBe(true)
  })

  it('clicking a leaf commits the path and closes', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    await w.find('[data-value="js"]').trigger('click')
    await w.find('[data-value="nj"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['js', 'nj']])
    expect(w.find('[data-iris-cascader-panel]').exists()).toBe(false)
  })

  it('renders the selected path in the trigger', () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS, modelValue: ['zj', 'hz', 'wl'] } })
    expect(w.find('[data-iris-cascader-value]').text()).toBe('Zhejiang / Hangzhou / West Lake')
  })

  it('a11y: trigger haspopup + expanded toggles', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    const t = trigger(w)
    expect(t.attributes('aria-haspopup')).toBe('listbox')
    expect(t.attributes('aria-expanded')).toBe('false')
    await t.trigger('click')
    expect(t.attributes('aria-expanded')).toBe('true')
  })

  it('disabled trigger has disabled attribute', () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS, disabled: true } })
    expect(trigger(w).attributes('disabled')).toBeDefined()
  })

  it('Escape closes the panel', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    expect(w.find('[data-iris-cascader-panel]').exists()).toBe(true)
    await trigger(w).trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-iris-cascader-panel]').exists()).toBe(false)
  })

  it('custom separator renders in trigger value', () => {
    const w = mount(IrisCascader, {
      props: { options: OPTIONS, modelValue: ['zj', 'hz'], separator: ' > ' },
    })
    expect(w.find('[data-iris-cascader-value]').text()).toBe('Zhejiang > Hangzhou')
  })

  it('aria-invalid when invalid', () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS, invalid: true } })
    expect(trigger(w).attributes('aria-invalid')).toBe('true')
  })

  it('data-state transitions open/closed', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    const root = w.find('[data-iris-cascader]')
    expect(root.attributes('data-state')).toBe('closed')
    await trigger(w).trigger('click')
    expect(root.attributes('data-state')).toBe('open')
    await trigger(w).trigger('keydown', { key: 'Escape' })
    expect(root.attributes('data-state')).toBe('closed')
  })

  it('ArrowDown opens the panel when closed', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    expect(panel(w).exists()).toBe(false)
    await trigger(w).trigger('keydown', { key: 'ArrowDown' })
    expect(panel(w).exists()).toBe(true)
  })

  it('shows three cascading levels for deep tree', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    await w.find('[data-value="zj"]').trigger('click')
    expect(columns(w).length).toBe(2)
    await w.find('[data-value="hz"]').trigger('click')
    expect(columns(w).length).toBe(3)
    expect(w.find('[data-value="wl"]').exists()).toBe(true)
  })

  it('handles empty options', async () => {
    const w = mount(IrisCascader, { props: { options: [] } })
    await trigger(w).trigger('click')
    expect(panel(w).exists()).toBe(true)
  })

  describe('virtual prop (opt-in windowing)', () => {
    it('windows a large column instead of rendering every option (bounded DOM)', async () => {
      const w = mount(IrisCascader, { props: { options: BIG, virtual: true } })
      await trigger(w).trigger('click')
      await nextTick()
      // jsdom collapses clientHeight to 0 after measure — the bound holds in
      // every phase (12 seeded / 4 collapsed options).
      expect(w.findAll('[data-iris-cascader-option]').length).toBeLessThanOrEqual(20)
      expect(w.find('[data-iris-virtual-spacer]').attributes('style')).toContain('height: 340000px')
    })

    it('scrolling moves the window (clientHeight mocked)', async () => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => 240,
      })
      try {
        const w = mount(IrisCascader, { props: { options: BIG, virtual: true } })
        await trigger(w).trigger('click')
        await nextTick()
        const scroller = w.find('[data-iris-virtual-scroll]').element as HTMLElement
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
        scroller.dispatchEvent(new Event('scroll'))
        await new Promise((r) => requestAnimationFrame(() => r(null)))
        await nextTick()
        expect(firstIndex()).toBeGreaterThanOrEqual(40)
      } finally {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', descriptor)
        else delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight
      }
    })

    it('deep path: windowed columns stay clickable after scrolling', async () => {
      const w = mount(IrisCascader, { props: { options: DEEP, virtual: true } })
      await trigger(w).trigger('click')
      await w.find('[data-value="r"]').trigger('click')
      await nextTick()
      const scrollers = w.findAll('[data-iris-virtual-scroll]')
      expect(scrollers.length).toBe(2) // one virtualizer per open column
      const scroller = scrollers[1]!.element as HTMLElement
      Object.defineProperty(scroller, 'scrollTop', {
        value: 9999 * 34,
        writable: true,
        configurable: true,
      })
      scroller.dispatchEvent(new Event('scroll'))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await nextTick()
      const leaf = w.find('[data-value="v9999"]')
      expect(leaf.exists()).toBe(true)
      await leaf.trigger('click')
      expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['r', 'v9999']])
      expect(panel(w).exists()).toBe(false)
    })

    it('default-off renders every option (no virtualizer in DOM)', async () => {
      const w = mount(IrisCascader, { props: { options: BIG } })
      await trigger(w).trigger('click')
      await nextTick()
      expect(w.findAll('[data-iris-cascader-option]').length).toBe(10_000)
      expect(w.find('[data-iris-virtual-scroll]').exists()).toBe(false)
    })

    it('a11y parity: virtual container carries the same surface as the plain listbox', async () => {
      const small: IrisCascaderNode[] = [
        { label: 'A', value: 'a', children: [{ label: 'A1', value: 'a1' }] },
        { label: 'B', value: 'b' },
      ]
      const plain = mount(IrisCascader, { props: { options: small } })
      await trigger(plain).trigger('click')
      const plainCol = plain.find('[data-iris-cascader-column]')
      const plainOpt = plainCol.find('[data-iris-cascader-option]')
      expect(plainCol.attributes('role')).toBe('listbox')
      expect(plainCol.attributes('data-level')).toBe('0')
      expect(plainOpt.attributes('role')).toBe('option')
      expect(plainOpt.attributes('aria-selected')).toBe('false')
      plain.unmount()
      const virt = mount(IrisCascader, { props: { options: small, virtual: true } })
      await trigger(virt).trigger('click')
      await nextTick()
      const virtCol = virt.find('[data-iris-cascader-column]')
      const virtOpt = virtCol.find('[data-iris-cascader-option]')
      expect(virtCol.attributes('role')).toBe('listbox')
      expect(virtCol.attributes('data-level')).toBe('0')
      expect(virtOpt.attributes('role')).toBe('option')
      expect(virtOpt.attributes('aria-selected')).toBe('false')
    })

    it('virtual with empty options renders the panel without crashing', async () => {
      const w = mount(IrisCascader, { props: { options: [], virtual: true } })
      await trigger(w).trigger('click')
      await nextTick()
      expect(panel(w).exists()).toBe(true)
      expect(columns(w).length).toBe(1)
      expect(w.findAll('[data-iris-cascader-option]').length).toBe(0)
    })
  })
})
