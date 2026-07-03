import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisClickOutside } from './ClickOutside'
import { IrisHotkey } from './Hotkey'
import { IrisLongPress } from './LongPress'
import { IrisMovable } from './Movable'
import { IrisResizable } from './Resizable'
import { IrisSortable } from './IrisSortable'

afterEach(cleanup)

describe('IrisClickOutside', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisClickOutside>
        <div>content</div>
      </IrisClickOutside>
    ))
    expect(container.querySelector('[data-iris-click-outside]')).not.toBeNull()
  })
})

describe('IrisHotkey', () => {
  it('renders children without crashing', () => {
    const { getByText } = render(() => (
      <IrisHotkey shortcut="Escape">
        <span>child</span>
      </IrisHotkey>
    ))
    expect(getByText('child')).not.toBeNull()
  })
})

describe('IrisMovable', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisMovable>
        <div>drag me</div>
      </IrisMovable>
    ))
    expect(container.querySelector('[data-iris-movable]')).not.toBeNull()
  })
})

describe('IrisResizable', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisResizable>
        <div>content</div>
      </IrisResizable>
    ))
    expect(container.querySelector('[data-iris-resizable]')).not.toBeNull()
  })

  it('renders resize handles', () => {
    const { container } = render(() => (
      <IrisResizable handles={['right', 'bottom']}>
        <div>content</div>
      </IrisResizable>
    ))
    expect(container.querySelector('[data-iris-resizable-handle="right"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-resizable-handle="bottom"]')).not.toBeNull()
  })
})

describe('IrisSortable', () => {
  it('renders items with data-iris-sortable-item attributes', () => {
    const { container } = render(() => (
      <IrisSortable items={['A', 'B', 'C']} onReorder={() => {}}>
        <div>A</div>
        <div>B</div>
        <div>C</div>
      </IrisSortable>
    ))
    const items = container.querySelectorAll('[data-iris-sortable-item]')
    expect(items.length).toBe(3)
    expect(items[0]?.getAttribute('data-iris-sortable-item')).toBe('0')
    expect(items[1]?.getAttribute('data-iris-sortable-item')).toBe('1')
    expect(items[2]?.getAttribute('data-iris-sortable-item')).toBe('2')
  })

  it('marks root data-iris-sortable and idle state', () => {
    const { container } = render(() => (
      <IrisSortable items={['A']} onReorder={() => {}}>
        <div>A</div>
      </IrisSortable>
    ))
    const root = container.querySelector('[data-iris-sortable]') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-state')).toBe('idle')
  })

  it('disabled state reflects on opacity', () => {
    const { container } = render(() => (
      <IrisSortable items={['A']} onReorder={() => {}} disabled>
        <div>A</div>
      </IrisSortable>
    ))
    const root = container.querySelector('[data-iris-sortable]') as HTMLElement
    expect(root.style.opacity).toBe('0.6')
  })
})

describe('IrisLongPress', () => {
  it('renders children inside a [data-iris-long-press] wrapper', () => {
    const { container } = render(() => (
      <IrisLongPress onLongPress={() => {}}>
        <div data-testid="child">x</div>
      </IrisLongPress>
    ))
    const wrapper = container.querySelector('[data-iris-long-press]')
    expect(wrapper).not.toBeNull()
    expect(container.querySelector('[data-testid=child]')).not.toBeNull()
  })

  it('fires onLongPress after holdDelay', async () => {
    const onLongPress = vi.fn()
    render(() => (
      <IrisLongPress holdDelay={10} onLongPress={onLongPress}>
        <div>x</div>
      </IrisLongPress>
    ))
    const wrapper = document.querySelector('[data-iris-long-press]')!
    fireEvent.pointerDown(wrapper)
    await new Promise((r) => setTimeout(r, 50))
    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('does not fire on quick release before holdDelay', async () => {
    const onLongPress = vi.fn()
    render(() => (
      <IrisLongPress holdDelay={50} onLongPress={onLongPress}>
        <div>x</div>
      </IrisLongPress>
    ))
    const wrapper = document.querySelector('[data-iris-long-press]')!
    fireEvent.pointerDown(wrapper)
    await new Promise((r) => setTimeout(r, 10))
    fireEvent.pointerUp(wrapper)
    await new Promise((r) => setTimeout(r, 60))
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
