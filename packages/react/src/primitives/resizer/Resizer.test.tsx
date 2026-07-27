import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisResizer } from './Resizer'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisResizer', () => {
  it('renders all 8 handles by default', () => {
    const { container } = render(
      <IrisResizer value={{ width: 200, height: 100 }} onValueChange={vi.fn()}>
        <div>x</div>
      </IrisResizer>,
    )
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(8)
  })

  it('width and height come from value', () => {
    const { container } = render(
      <IrisResizer value={{ width: 250, height: 175 }} onValueChange={vi.fn()}>
        <div>x</div>
      </IrisResizer>,
    )
    const el = container.querySelector('[data-iris-resizer]') as HTMLElement
    expect(el.style.width).toBe('250px')
    expect(el.style.height).toBe('175px')
  })

  it('handles prop limits which handles render', () => {
    const { container } = render(
      <IrisResizer
        value={{ width: 100, height: 100 }}
        onValueChange={vi.fn()}
        handles={['bottom-right']}
      >
        <div>x</div>
      </IrisResizer>,
    )
    const h = container.querySelectorAll('[data-iris-resizer-handle]')
    expect(h.length).toBe(1)
    expect(h[0]?.getAttribute('data-iris-resizer-handle')).toBe('bottom-right')
  })

  it('disabled state reflects on data-state', () => {
    const { container } = render(
      <IrisResizer value={{ width: 100, height: 100 }} onValueChange={vi.fn()} disabled>
        <div>x</div>
      </IrisResizer>,
    )
    expect(container.querySelector('[data-iris-resizer]')?.getAttribute('data-state')).toBe(
      'disabled',
    )
  })

  it('cursor on side handles is ew-resize / ns-resize', () => {
    const { container } = render(
      <IrisResizer
        value={{ width: 100, height: 100 }}
        onValueChange={vi.fn()}
        handles={['top', 'right']}
      >
        <div>x</div>
      </IrisResizer>,
    )
    const top = container.querySelector('[data-iris-resizer-handle=top]') as HTMLElement
    const right = container.querySelector('[data-iris-resizer-handle=right]') as HTMLElement
    expect(top.style.cursor).toBe('ns-resize')
    expect(right.style.cursor).toBe('ew-resize')
  })

  it('corner handle cursor is nwse/nesw', () => {
    const { container } = render(
      <IrisResizer
        value={{ width: 100, height: 100 }}
        onValueChange={vi.fn()}
        handles={['top-left', 'bottom-right']}
      >
        <div>x</div>
      </IrisResizer>,
    )
    const tl = container.querySelector('[data-iris-resizer-handle=top-left]') as HTMLElement
    const br = container.querySelector('[data-iris-resizer-handle=bottom-right]') as HTMLElement
    expect(tl.style.cursor).toBe('nwse-resize')
    expect(br.style.cursor).toBe('nwse-resize')
  })
})
