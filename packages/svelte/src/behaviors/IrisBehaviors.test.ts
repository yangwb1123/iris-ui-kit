import { render, fireEvent } from '@testing-library/svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisClickOutside from './IrisClickOutside.svelte'
import IrisHotkey from './IrisHotkey.svelte'
import IrisLongPress from './IrisLongPress.svelte'
import IrisLongPressHarness from './IrisLongPressHarness.svelte'
import IrisMovable from './IrisMovable.svelte'
import IrisResizable from './IrisResizable.svelte'
import IrisSortableHarness from './IrisSortableHarness.svelte'

describe('IrisClickOutside', () => {
  it('renders its children', () => {
    const { container } = render(IrisClickOutside)
    expect(container.querySelector('[data-iris-click-outside]')).toBeTruthy()
  })
})

describe('IrisHotkey', () => {
  it('renders its children without crashing', () => {
    // Renderless wrapper — just verify no crash
    const { container } = render(IrisHotkey, { props: { shortcut: 'Escape' } })
    expect(container).toBeTruthy()
  })
})

describe('IrisMovable', () => {
  it('renders with initial position', () => {
    const { container } = render(IrisMovable, {
      props: { defaultPosition: { x: 10, y: 20 } },
    })
    const el = container.querySelector('[data-iris-movable]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.style.transform).toContain('translate(10px, 20px)')
  })
})

describe('IrisResizable', () => {
  it('renders with default size', () => {
    const { container } = render(IrisResizable, {
      props: { defaultSize: { width: 200, height: 100 } },
    })
    const el = container.querySelector('[data-iris-resizable]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('100px')
  })

  it('renders resize handles', () => {
    const { container } = render(IrisResizable, {
      props: { handles: ['right', 'bottom'] },
    })
    expect(container.querySelector('[data-iris-resizable-handle="right"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-resizable-handle="bottom"]')).toBeTruthy()
  })
})

describe('IrisSortable', () => {
  it('renders items with data-iris-sortable-item attributes', () => {
    const { container } = render(IrisSortableHarness, {
      props: { items: ['A', 'B', 'C'] },
    })
    const items = container.querySelectorAll('[data-iris-sortable-item]')
    expect(items.length).toBe(3)
    expect(items[0]?.getAttribute('data-iris-sortable-item')).toBe('0')
    expect(items[1]?.getAttribute('data-iris-sortable-item')).toBe('1')
    expect(items[2]?.getAttribute('data-iris-sortable-item')).toBe('2')
  })

  it('marks root data-iris-sortable and idle state', () => {
    const { container } = render(IrisSortableHarness, {
      props: { items: ['A'] },
    })
    const root = container.querySelector('[data-iris-sortable]') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-state')).toBe('idle')
  })

  it('disabled state reflects on opacity', () => {
    const { container } = render(IrisSortableHarness, {
      props: { items: ['A'], disabled: true },
    })
    const root = container.querySelector('[data-iris-sortable]') as HTMLElement
    expect(root.style.opacity).toBe('0.6')
  })
})

describe('IrisLongPress', () => {
  it('renders children inside a display:contents span', () => {
    const { container } = render(IrisLongPressHarness, {
      props: { onLongPress: () => {} },
    })
    const wrapper = container.querySelector('[data-iris-long-press]')
    expect(wrapper).not.toBeNull()
    expect(container.querySelector('[data-testid=child]')).not.toBeNull()
  })

  it('fires onLongPress after holdDelay', async () => {
    const onLongPress = vi.fn()
    render(IrisLongPress, { props: { holdDelay: 10, onLongPress } })
    const wrapper = document.querySelector('[data-iris-long-press]')!
    await fireEvent.pointerDown(wrapper)
    await new Promise((r) => setTimeout(r, 50))
    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('does not fire on quick release before holdDelay', async () => {
    const onLongPress = vi.fn()
    render(IrisLongPress, { props: { holdDelay: 50, onLongPress } })
    const wrapper = document.querySelector('[data-iris-long-press]')!
    await fireEvent.pointerDown(wrapper)
    await new Promise((r) => setTimeout(r, 10))
    await fireEvent.pointerUp(wrapper)
    await new Promise((r) => setTimeout(r, 60))
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
