import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisClickOutside from './IrisClickOutside.svelte'
import IrisHotkey from './IrisHotkey.svelte'
import IrisMovable from './IrisMovable.svelte'
import IrisResizable from './IrisResizable.svelte'

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
