import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisAnchor } from './Anchor'

const rect = (top: number): DOMRect =>
  ({
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect

function section(id: string): HTMLElement {
  const d = document.createElement('div')
  d.id = id
  d.setAttribute('data-test-section', '')
  document.body.appendChild(d)
  return d
}

afterEach(() => {
  document.querySelectorAll('[data-test-section]').forEach((e) => e.remove())
})

const links = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-anchor-link]')

describe('IrisAnchor', () => {
  it('renders a nav of links', () => {
    const w = mount(IrisAnchor, {
      props: {
        items: [
          { href: '#a', title: 'A' },
          { href: '#b', title: 'B' },
        ],
      },
    })
    expect(w.find('nav[data-iris-anchor]').exists()).toBe(true)
    expect(links(w).length).toBe(2)
    expect(links(w)[0].attributes('href')).toBe('#a')
  })

  it('clicking a link scrolls to the target and emits change', async () => {
    const sec = section('a')
    const spy = vi.fn()
    ;(sec as unknown as { scrollIntoView: unknown }).scrollIntoView = spy
    const w = mount(IrisAnchor, { props: { items: [{ href: '#a', title: 'A' }] } })
    await links(w)[0].trigger('click')
    expect(spy).toHaveBeenCalled()
    expect(links(w)[0].attributes('aria-current')).toBe('true')
    expect(w.emitted('change')?.some((c) => c[0] === '#a')).toBe(true)
  })

  it('scroll-spy activates the last passed section', async () => {
    const a = section('a')
    const b = section('b')
    a.getBoundingClientRect = () => rect(-10)
    b.getBoundingClientRect = () => rect(100)
    const w = mount(IrisAnchor, {
      props: {
        items: [
          { href: '#a', title: 'A' },
          { href: '#b', title: 'B' },
        ],
      },
    })
    await nextTick()
    expect(links(w)[0].attributes('aria-current')).toBe('true')
    b.getBoundingClientRect = () => rect(-5)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(links(w)[1].attributes('aria-current')).toBe('true')
  })
})
