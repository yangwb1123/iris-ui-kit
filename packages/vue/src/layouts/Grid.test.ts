import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisGrid } from './Grid'

describe('IrisGrid', () => {
  it('renders with display: grid', () => {
    const w = mount(IrisGrid, { slots: { default: '<div>a</div>' } })
    expect(w.attributes('style')).toContain('display: grid')
  })

  it('inline=true uses inline-grid', () => {
    const w = mount(IrisGrid, { props: { inline: true } })
    expect(w.attributes('style')).toContain('display: inline-grid')
  })

  it('integer columns → repeat(N, minmax(0, 1fr))', () => {
    const w = mount(IrisGrid, { props: { columns: 3 } })
    expect(w.attributes('style')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
  })

  it('auto-fit columns → repeat(auto-fit, minmax(...))', () => {
    const w = mount(IrisGrid, { props: { columns: 'auto-fit', minColWidth: '180px' } })
    expect(w.attributes('style')).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))',
    )
  })

  it('auto-fill works the same way', () => {
    const w = mount(IrisGrid, { props: { columns: 'auto-fill', minColWidth: '120px' } })
    expect(w.attributes('style')).toContain('repeat(auto-fill, minmax(120px, 1fr))')
  })

  it('raw CSS string is passed through verbatim', () => {
    const w = mount(IrisGrid, { props: { columns: '200px 1fr 100px' } })
    expect(w.attributes('style')).toContain('grid-template-columns: 200px 1fr 100px')
  })

  it('default gap=md → token var', () => {
    const w = mount(IrisGrid)
    const style = w.attributes('style') ?? ''
    expect(style).toContain('row-gap: var(--iris-gap-md)')
    expect(style).toContain('column-gap: var(--iris-gap-md)')
  })

  it('numeric gap → px', () => {
    const w = mount(IrisGrid, { props: { gap: 24 } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('row-gap: 24px')
    expect(style).toContain('column-gap: 24px')
  })

  it('separate rowGap / columnGap', () => {
    const w = mount(IrisGrid, { props: { rowGap: 'sm', columnGap: 'lg' } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('row-gap: var(--iris-gap-sm)')
    expect(style).toContain('column-gap: var(--iris-gap-lg)')
  })

  it('data-iris-grid-columns reflects the columns prop', () => {
    expect(mount(IrisGrid, { props: { columns: 3 } }).attributes('data-iris-grid-columns')).toBe(
      '3',
    )
    expect(
      mount(IrisGrid, { props: { columns: 'auto-fit' } }).attributes('data-iris-grid-columns'),
    ).toBe('auto-fit')
  })
})
