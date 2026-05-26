import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisStack } from './Stack'
import { IrisContainer } from './Container'

describe('IrisStack', () => {
  it('renders children with flex layout', () => {
    const w = mount(IrisStack, { slots: { default: '<div>A</div><div>B</div>' } })
    expect(w.attributes('style')).toContain('display: flex')
  })

  it('default direction is column', () => {
    const w = mount(IrisStack)
    expect(w.attributes('data-iris-stack-direction')).toBe('column')
    expect(w.attributes('style')).toContain('flex-direction: column')
  })

  it('direction="row" flips data attr + flex-direction', () => {
    const w = mount(IrisStack, { props: { direction: 'row' } })
    expect(w.attributes('data-iris-stack-direction')).toBe('row')
    expect(w.attributes('style')).toContain('flex-direction: row')
  })

  it('numeric spacing → px', () => {
    const w = mount(IrisStack, { props: { spacing: 24 } })
    expect(w.attributes('style')).toContain('gap: 24px')
  })

  it('token spacing → CSS var', () => {
    const w = mount(IrisStack, { props: { spacing: 'lg' } })
    expect(w.attributes('style')).toContain('gap: var(--iris-gap-lg)')
  })

  it('align/justify map to flex values', () => {
    const w = mount(IrisStack, { props: { align: 'center', justify: 'between' } })
    expect(w.attributes('style')).toContain('align-items: center')
    expect(w.attributes('style')).toContain('justify-content: space-between')
  })

  it('wrap=true sets flex-wrap', () => {
    const w = mount(IrisStack, { props: { wrap: true } })
    expect(w.attributes('style')).toContain('flex-wrap: wrap')
  })

  it('inline=true uses inline-flex', () => {
    const w = mount(IrisStack, { props: { inline: true } })
    expect(w.attributes('style')).toContain('display: inline-flex')
  })
})

describe('IrisContainer', () => {
  it('renders children', () => {
    const w = mount(IrisContainer, { slots: { default: 'content' } })
    expect(w.text()).toBe('content')
  })

  it('default maxWidth=lg → 1024px', () => {
    const w = mount(IrisContainer)
    expect(w.attributes('data-iris-container-max-width')).toBe('lg')
    expect(w.attributes('style')).toContain('max-width: 1024px')
  })

  it('maxWidth=sm/md/xl map correctly', () => {
    expect(mount(IrisContainer, { props: { maxWidth: 'sm' } }).attributes('style')).toContain('640px')
    expect(mount(IrisContainer, { props: { maxWidth: 'md' } }).attributes('style')).toContain('768px')
    expect(mount(IrisContainer, { props: { maxWidth: 'xl' } }).attributes('style')).toContain('1280px')
  })

  it('arbitrary CSS length forwarded as-is', () => {
    const w = mount(IrisContainer, { props: { maxWidth: '900px' } })
    expect(w.attributes('style')).toContain('max-width: 900px')
  })

  it('maxWidth="full" → 100%', () => {
    const w = mount(IrisContainer, { props: { maxWidth: 'full' } })
    expect(w.attributes('style')).toContain('max-width: 100%')
  })

  it('center=true (default) adds auto margins', () => {
    const w = mount(IrisContainer)
    const style = w.attributes('style') ?? ''
    expect(style).toContain('margin-left: auto')
    expect(style).toContain('margin-right: auto')
  })

  it('center=false skips auto margins', () => {
    const w = mount(IrisContainer, { props: { center: false } })
    const style = w.attributes('style') ?? ''
    expect(style).not.toContain('margin-left: auto')
  })

  it('numeric padding → px', () => {
    const w = mount(IrisContainer, { props: { padding: 24 } })
    expect(w.attributes('style')).toContain('padding: 0px 24px')
  })

  it('token padding → CSS var', () => {
    const w = mount(IrisContainer, { props: { padding: 'lg' } })
    expect(w.attributes('style')).toContain('var(--iris-padding-lg)')
  })
})
