import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `R${i + 1}` }))

const rootOf = (wrapper: ReturnType<typeof mount>): HTMLElement =>
  wrapper.find('[data-iris-table]').element as HTMLElement
const viewportOf = (wrapper: ReturnType<typeof mount>): HTMLElement | null => {
  const el = wrapper.find('[data-iris-virtual-scroll]')
  return el.exists() ? (el.element as HTMLElement) : null
}
const backTopOf = (wrapper: ReturnType<typeof mount>): HTMLElement | null => {
  const el = wrapper.find('[data-iris-back-top-table]')
  return el.exists() ? (el.element as HTMLElement) : null
}

async function scroll(el: HTMLElement, top: number): Promise<void> {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
  await nextTick()
}

function fixedProps() {
  return { columns, data: rows, rowKey: 'id', style: { height: '300px', overflow: 'auto' } }
}

describe('@iris-ui-kit/vue IrisTable back-to-top (batch FS)', () => {
  it('is default-off with no button or anchor', () => {
    const wrapper = mount(IrisTable, { props: fixedProps() })
    expect(backTopOf(wrapper)).toBeNull()
    expect(wrapper.find('[data-iris-back-top-anchor]').exists()).toBe(false)
  })

  it('uses the root scroller at the inclusive 200px threshold', async () => {
    const wrapper = mount(IrisTable, { props: { ...fixedProps(), scrollToTop: true } })
    const root = rootOf(wrapper)
    await scroll(root, 199)
    expect(backTopOf(wrapper)).toBeNull()
    await scroll(root, 200)
    const button = backTopOf(wrapper)
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-label')).toBe('Back to top')
    expect(button?.getAttribute('title')).toBe('Back to top')
    expect(button?.textContent).toBe('↑')
    expect(wrapper.find('[data-iris-back-top-anchor]').element.style.position).toBe('sticky')
  })

  it('clicks through scrollTo and falls back to scrollTop', async () => {
    const wrapper = mount(IrisTable, { props: { ...fixedProps(), scrollToTop: true } })
    const root = rootOf(wrapper)
    await scroll(root, 400)

    const scrollTo = vi.fn()
    Object.defineProperty(root, 'scrollTo', { configurable: true, value: scrollTo })
    await wrapper.get('[data-iris-back-top-table]').trigger('click')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    Object.defineProperty(root, 'scrollTo', {
      configurable: true,
      value: () => {
        throw new Error('unsupported')
      },
    })
    await scroll(root, 400)
    await wrapper.get('[data-iris-back-top-table]').trigger('click')
    expect(root.scrollTop).toBe(0)
  })

  it('uses auto behavior when reduced motion is requested', async () => {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    })
    try {
      const wrapper = mount(IrisTable, { props: { ...fixedProps(), scrollToTop: true } })
      const root = rootOf(wrapper)
      const scrollTo = vi.fn()
      Object.defineProperty(root, 'scrollTo', { configurable: true, value: scrollTo })
      await scroll(root, 400)
      await wrapper.get('[data-iris-back-top-table]').trigger('click')
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: original })
    }
  })

  it('resolves the virtual viewport at event time', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        scrollToTop: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    const root = rootOf(wrapper)
    const viewport = viewportOf(wrapper)
    expect(viewport).not.toBeNull()
    await scroll(root, 300)
    expect(backTopOf(wrapper)).toBeNull()
    root.scrollTop = 0
    await scroll(viewport!, 320)
    expect(backTopOf(wrapper)).not.toBeNull()

    const scrollTo = vi.fn()
    Object.defineProperty(viewport!, 'scrollTo', { configurable: true, value: scrollTo })
    await wrapper.get('[data-iris-back-top-table]').trigger('click')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(root.scrollTop).toBe(0)
  })

  it('re-arms after empty async data and virtual-mode changes', async () => {
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        scrollToTop: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    expect(viewportOf(wrapper)).toBeNull()

    await wrapper.setProps({ data: rows })
    const viewport = viewportOf(wrapper)
    expect(viewport).not.toBeNull()
    await scroll(rootOf(wrapper), 300)
    expect(backTopOf(wrapper)).toBeNull()
    await scroll(viewport!, 320)
    expect(backTopOf(wrapper)).not.toBeNull()

    await wrapper.setProps({ virtualScroll: undefined, style: fixedProps().style })
    await scroll(rootOf(wrapper), 300)
    expect(backTopOf(wrapper)).not.toBeNull()
  })

  it('cleans listeners and nodes when disabled or unmounted', async () => {
    const wrapper = mount(IrisTable, { props: { ...fixedProps(), scrollToTop: true } })
    const root = rootOf(wrapper)
    const removeScroll = vi.spyOn(root, 'removeEventListener')
    await wrapper.setProps({ scrollToTop: false })
    expect(backTopOf(wrapper)).toBeNull()
    expect(removeScroll).toHaveBeenCalledWith('scroll', expect.any(Function))
    await scroll(root, 500)
    expect(backTopOf(wrapper)).toBeNull()

    await wrapper.setProps({ scrollToTop: true })
    expect(removeScroll).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(removeScroll).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('does not render in printable mode and keeps the control token-styled', async () => {
    const wrapper = mount(IrisTable, {
      props: { ...fixedProps(), scrollToTop: true, printable: true },
    })
    await scroll(rootOf(wrapper), 400)
    expect(backTopOf(wrapper)).toBeNull()

    await wrapper.setProps({ printable: false })
    const button = backTopOf(wrapper)
    expect(button).not.toBeNull()
    expect(button?.style.background).toBe('var(--iris-surface, var(--iris-background))')
    expect(button?.style.color).toBe('var(--iris-foreground)')
    expect(button?.style.insetInlineEnd).toBe('24px')
  })
})
