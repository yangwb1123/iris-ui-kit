import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisDragger from './IrisDragger.svelte'

afterEach(cleanup)

describe('IrisDragger', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisDragger)
    expect(container).toBeTruthy()
  })

  it('renders with correct transform at default position', () => {
    const { container } = render(IrisDragger, { props: { value: { x: 0, y: 0 } } })
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('translate3d(0px, 0px, 0)')
  })

  it('renders with custom position', () => {
    const { container } = render(IrisDragger, { props: { value: { x: 100, y: 50 } } })
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('translate3d(100px, 50px, 0)')
  })

  it('is in idle state initially', () => {
    const { container } = render(IrisDragger)
    expect(container.querySelector('[data-iris-dragger]')?.getAttribute('data-state')).toBe('idle')
  })

  it('renders from defaultValue when uncontrolled (no value bound)', () => {
    const { container } = render(IrisDragger, { props: { defaultValue: { x: 30, y: 40 } } })
    const el = container.querySelector('[data-iris-dragger]') as HTMLElement
    expect(el.style.transform).toContain('translate3d(30px, 40px, 0)')
  })
})
