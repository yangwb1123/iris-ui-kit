import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisSkeleton } from './Skeleton'
import { __SKELETON_STYLE_ID, __resetSkeletonStyles } from './styles'

describe('IrisSkeleton', () => {
  beforeEach(() => __resetSkeletonStyles())
  afterEach(() => __resetSkeletonStyles())

  it('renders a div with the right data attrs', () => {
    const w = mount(IrisSkeleton)
    expect(w.element.tagName).toBe('DIV')
    expect(w.attributes('data-iris-skeleton')).toBe('')
    expect(w.attributes('data-iris-skeleton-shape')).toBe('rect')
    expect(w.attributes('data-iris-skeleton-animated')).toBe('true')
  })

  it('is announced as aria-busy', () => {
    const w = mount(IrisSkeleton)
    expect(w.attributes('aria-busy')).toBe('true')
    expect(w.attributes('role')).toBe('status')
  })

  it('default rect uses full width and auto height', () => {
    const w = mount(IrisSkeleton)
    const style = w.attributes('style') ?? ''
    expect(style).toContain('width: 100%')
    expect(style).toContain('height: auto')
  })

  it('shape="text" defaults height to 1em', () => {
    const w = mount(IrisSkeleton, { props: { shape: 'text' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('height: 1em')
  })

  it('shape="circle" defaults to 40x40', () => {
    const w = mount(IrisSkeleton, { props: { shape: 'circle' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('width: 40px')
    expect(style).toContain('height: 40px')
  })

  it('accepts numeric and string sizes', () => {
    const w1 = mount(IrisSkeleton, { props: { width: 200, height: 24 } })
    expect(w1.attributes('style')).toContain('width: 200px')
    expect(w1.attributes('style')).toContain('height: 24px')
    const w2 = mount(IrisSkeleton, { props: { width: '30%', height: '2rem' } })
    expect(w2.attributes('style')).toContain('width: 30%')
    expect(w2.attributes('style')).toContain('height: 2rem')
  })

  it('animated=false flips the data attr', () => {
    const w = mount(IrisSkeleton, { props: { animated: false } })
    expect(w.attributes('data-iris-skeleton-animated')).toBe('false')
  })

  it('installs the stylesheet exactly once', () => {
    mount(IrisSkeleton)
    mount(IrisSkeleton)
    mount(IrisSkeleton)
    expect(document.querySelectorAll(`#${__SKELETON_STYLE_ID}`)).toHaveLength(1)
  })
})
