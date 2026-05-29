import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisMasonry } from './Masonry'

const root = (w: ReturnType<typeof mount>) => w.find('[data-iris-masonry]').element as HTMLElement
const items = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-masonry-item]')

describe('IrisMasonry', () => {
  it('wraps each child in an item', () => {
    const w = mount(IrisMasonry, { slots: { default: '<div>1</div><div>2</div><div>3</div>' } })
    expect(items(w).length).toBe(3)
    expect(items(w)[0].text()).toBe('1')
  })

  it('applies the column count', () => {
    const w = mount(IrisMasonry, { props: { columns: 4 }, slots: { default: '<div>1</div>' } })
    expect(w.find('[data-iris-masonry]').attributes('data-columns')).toBe('4')
  })

  it('applies the gap', () => {
    const w = mount(IrisMasonry, { props: { gap: 24 }, slots: { default: '<div>1</div>' } })
    expect(root(w).style.columnGap).toBe('24px')
  })
})
