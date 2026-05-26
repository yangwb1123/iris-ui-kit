import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisDragger } from './Dragger'

afterEach(() => cleanup())

describe('@iris-ui/react IrisDragger', () => {
  it('renders wrapper with data-iris-dragger', () => {
    const { container } = render(
      <IrisDragger>
        <span>x</span>
      </IrisDragger>,
    )
    expect(container.querySelector('[data-iris-dragger]')).not.toBeNull()
  })

  it('initial position is 0,0 by default', () => {
    const { container } = render(<IrisDragger>x</IrisDragger>)
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('translate3d(0px, 0px, 0)')
  })

  it('controlled value drives transform', () => {
    const { container } = render(
      <IrisDragger value={{ x: 42, y: -7 }}>x</IrisDragger>,
    )
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('translate3d(42px, -7px, 0)')
  })

  it('defaultValue applies for uncontrolled', () => {
    const { container } = render(
      <IrisDragger defaultValue={{ x: 5, y: 10 }}>x</IrisDragger>,
    )
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('translate3d(5px, 10px, 0)')
  })

  it('data-state="idle" initially', () => {
    const { container } = render(<IrisDragger>x</IrisDragger>)
    expect(
      container.querySelector('[data-iris-dragger]')?.getAttribute('data-state'),
    ).toBe('idle')
  })

  it('renders a separate handle when handle prop is provided', () => {
    const { container } = render(
      <IrisDragger handle={<span>≡</span>}>body</IrisDragger>,
    )
    expect(container.querySelector('[data-iris-dragger-handle]')).not.toBeNull()
  })

  it('disabled prop sets cursor to not-allowed', () => {
    const { container } = render(<IrisDragger disabled>x</IrisDragger>)
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.cursor).toBe('not-allowed')
  })
})
