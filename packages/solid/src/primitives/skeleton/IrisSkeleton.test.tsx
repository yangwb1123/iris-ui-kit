import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisSkeleton, resetSkeletonStyles } from './IrisSkeleton'

beforeEach(resetSkeletonStyles)
afterEach(cleanup)

describe('IrisSkeleton', () => {
  it('renders with role=status and aria-busy', () => {
    const { container } = render(() => <IrisSkeleton />)
    const el = container.querySelector('[data-iris-skeleton]')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('role')).toBe('status')
    expect(el?.getAttribute('aria-busy')).toBe('true')
  })

  it('defaults to rect shape', () => {
    const { container } = render(() => <IrisSkeleton />)
    expect(container.querySelector('[data-iris-skeleton-shape="rect"]')).not.toBeNull()
  })

  it('applies circle shape', () => {
    const { container } = render(() => <IrisSkeleton shape="circle" />)
    expect(container.querySelector('[data-iris-skeleton-shape="circle"]')).not.toBeNull()
  })

  it('injects skeleton styles on mount', () => {
    render(() => <IrisSkeleton />)
    expect(document.getElementById('iris-skeleton-styles')).not.toBeNull()
  })

  it('respects width and height props', () => {
    const { container } = render(() => <IrisSkeleton width={200} height={100} />)
    const el = container.querySelector('[data-iris-skeleton]') as HTMLElement
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('100px')
  })
})
