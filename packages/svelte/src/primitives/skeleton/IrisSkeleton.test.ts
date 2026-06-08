import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisSkeleton from './IrisSkeleton.svelte'
import { __resetSkeletonStyles } from './styles'

afterEach(() => {
  cleanup()
  __resetSkeletonStyles()
})

describe('@iris-ui/svelte IrisSkeleton', () => {
  it('renders a div with role=status and aria-busy', () => {
    const { container } = render(IrisSkeleton)
    const el = container.querySelector('[data-iris-skeleton]')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('role')).toBe('status')
    expect(el!.getAttribute('aria-busy')).toBe('true')
  })

  it('defaults to rect shape', () => {
    const { container } = render(IrisSkeleton)
    expect(container.querySelector('[data-iris-skeleton-shape="rect"]')).not.toBeNull()
  })

  it('sets circle shape and 50% border-radius via stylesheet', () => {
    const { container } = render(IrisSkeleton, { props: { shape: 'circle' } })
    expect(container.querySelector('[data-iris-skeleton-shape="circle"]')).not.toBeNull()
  })

  it('applies width/height to inline style', () => {
    const { container } = render(IrisSkeleton, { props: { width: 120, height: 40 } })
    const el = container.querySelector<HTMLElement>('[data-iris-skeleton]')!
    expect(el.getAttribute('style')).toContain('120px')
    expect(el.getAttribute('style')).toContain('40px')
  })

  it('installs the skeleton stylesheet once', () => {
    render(IrisSkeleton)
    render(IrisSkeleton)
    expect(document.querySelectorAll('#iris-skeleton-styles')).toHaveLength(1)
  })
})
