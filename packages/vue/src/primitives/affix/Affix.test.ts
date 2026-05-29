import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisAffix } from './Affix'

const rect = (top: number): DOMRect =>
  ({
    top,
    bottom: top + 40,
    left: 0,
    right: 0,
    width: 0,
    height: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect

describe('IrisAffix', () => {
  it('renders its slot content', () => {
    const w = mount(IrisAffix, { slots: { default: () => h('div', { 'data-child': '' }, 'Nav') } })
    expect(w.find('[data-child]').text()).toBe('Nav')
  })

  it('affixes / unaffixes based on the offset', async () => {
    const w = mount(IrisAffix, {
      props: { offsetTop: 0 },
      slots: { default: () => h('div', 'Nav') },
    })
    const ph = w.find('[data-iris-affix]').element as HTMLElement
    ph.getBoundingClientRect = () => rect(100)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(w.find('[data-iris-affix]').attributes('data-affixed')).toBeUndefined()
    ph.getBoundingClientRect = () => rect(-50)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(w.find('[data-iris-affix]').attributes('data-affixed')).toBe('true')
  })

  it('emits change when the affixed state flips', async () => {
    const w = mount(IrisAffix, {
      props: { offsetTop: 0 },
      slots: { default: () => h('div', 'Nav') },
    })
    const ph = w.find('[data-iris-affix]').element as HTMLElement
    ph.getBoundingClientRect = () => rect(100)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    ph.getBoundingClientRect = () => rect(-50)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(w.emitted('change')?.some((c) => c[0] === true)).toBe(true)
  })

  it('pins the content with a fixed offset when affixed', async () => {
    const w = mount(IrisAffix, {
      props: { offsetTop: 8 },
      slots: { default: () => h('div', 'Nav') },
    })
    const ph = w.find('[data-iris-affix]').element as HTMLElement
    ph.getBoundingClientRect = () => rect(-50)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    const content = w.find('[data-iris-affix-content]').element as HTMLElement
    expect(content.style.position).toBe('fixed')
    expect(content.style.top).toBe('8px')
  })
})
