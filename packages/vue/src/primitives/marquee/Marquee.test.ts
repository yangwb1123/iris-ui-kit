import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisMarquee } from './Marquee'

const copies = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-marquee-content]')

describe('IrisMarquee', () => {
  it('renders the content', () => {
    const w = mount(IrisMarquee, { slots: { default: '<span>News flash</span>' } })
    expect(copies(w)[0].text()).toBe('News flash')
  })

  it('duplicates content for a seamless loop; the copy is aria-hidden', () => {
    const w = mount(IrisMarquee, { slots: { default: '<span>x</span>' } })
    expect(copies(w).length).toBe(2)
    expect(copies(w)[0].attributes('aria-hidden')).toBeUndefined()
    expect(copies(w)[1].attributes('aria-hidden')).toBe('true')
  })

  it('clips overflow', () => {
    const w = mount(IrisMarquee, { slots: { default: '<span>x</span>' } })
    expect((w.find('[data-iris-marquee]').element as HTMLElement).style.overflow).toBe('hidden')
  })
})
