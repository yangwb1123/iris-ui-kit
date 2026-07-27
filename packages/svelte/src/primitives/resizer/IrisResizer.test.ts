import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import IrisResizer from './IrisResizer.svelte'

afterEach(cleanup)

describe('IrisResizer', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisResizer, { props: { value: { width: 200, height: 150 } } })
    expect(container).toBeTruthy()
  })

  it('renders the wrapper with correct size', () => {
    const { container } = render(IrisResizer, { props: { value: { width: 300, height: 200 } } })
    const el = container.querySelector('[data-iris-resizer]') as HTMLElement
    expect(el.style.width).toBe('300px')
    expect(el.style.height).toBe('200px')
  })

  it('renders handle elements', () => {
    const { container } = render(IrisResizer, {
      props: { value: { width: 200, height: 150 }, handles: ['bottom-right', 'right'] },
    })
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(2)
  })

  it('wires handles added by a rerender and supports keyboard resizing', async () => {
    const onValueChange = vi.fn()
    const { container, rerender } = render(IrisResizer, {
      props: {
        value: { width: 200, height: 150 },
        handles: ['right'],
        onValueChange,
      },
    })
    await rerender({
      value: { width: 200, height: 150 },
      handles: ['bottom'],
      onValueChange,
    })
    expect(container.querySelector('[data-iris-resizer-handle="right"]')).toBeNull()
    const bottom = container.querySelector('[data-iris-resizer-handle="bottom"]')!
    await fireEvent.keyDown(bottom, { key: 'ArrowDown' })
    expect(onValueChange).toHaveBeenCalledWith({ width: 200, height: 160 })
  })
})
