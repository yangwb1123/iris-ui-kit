import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisSkeleton } from './Skeleton'
import { __SKELETON_STYLE_ID, __resetSkeletonStyles } from './styles'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisSkeleton', () => {
  beforeEach(() => __resetSkeletonStyles())
  afterEach(() => __resetSkeletonStyles())

  it('renders a div with data attrs', () => {
    const { container } = render(<IrisSkeleton />)
    const el = container.querySelector('[data-iris-skeleton]')!
    expect(el.tagName).toBe('DIV')
    expect(el.getAttribute('data-iris-skeleton-shape')).toBe('rect')
    expect(el.getAttribute('data-iris-skeleton-animated')).toBe('true')
  })

  it('aria-busy + role status', () => {
    const { container } = render(<IrisSkeleton />)
    const el = container.querySelector('[data-iris-skeleton]')!
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(el.getAttribute('role')).toBe('status')
  })

  it('text shape height = 1em', () => {
    const { container } = render(<IrisSkeleton shape="text" />)
    expect(container.querySelector('[data-iris-skeleton]')!.getAttribute('style')).toContain(
      'height: 1em',
    )
  })

  it('circle defaults to 40x40', () => {
    const { container } = render(<IrisSkeleton shape="circle" />)
    const style = container.querySelector('[data-iris-skeleton]')!.getAttribute('style')!
    expect(style).toContain('width: 40px')
    expect(style).toContain('height: 40px')
  })

  it('accepts numeric and string sizes', () => {
    const { container, rerender } = render(<IrisSkeleton width={200} height={24} />)
    let style = container.querySelector('[data-iris-skeleton]')!.getAttribute('style')!
    expect(style).toContain('width: 200px')
    expect(style).toContain('height: 24px')
    rerender(<IrisSkeleton width="30%" height="2rem" />)
    style = container.querySelector('[data-iris-skeleton]')!.getAttribute('style')!
    expect(style).toContain('width: 30%')
    expect(style).toContain('height: 2rem')
  })

  it('animated=false flips data attr', () => {
    const { container } = render(<IrisSkeleton animated={false} />)
    expect(
      container.querySelector('[data-iris-skeleton]')!.getAttribute('data-iris-skeleton-animated'),
    ).toBe('false')
  })

  it('installs stylesheet once', () => {
    render(<IrisSkeleton />)
    render(<IrisSkeleton />)
    render(<IrisSkeleton />)
    expect(document.querySelectorAll(`#${__SKELETON_STYLE_ID}`)).toHaveLength(1)
  })
})
