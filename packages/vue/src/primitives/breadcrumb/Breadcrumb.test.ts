import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisBreadcrumb } from './Breadcrumb'
import { IrisBreadcrumbItem } from './BreadcrumbItem'

function buildHarness(items: { href?: string; label: string }[]) {
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisBreadcrumb,
          null,
          {
            default: () =>
              items.map((it) =>
                h(IrisBreadcrumbItem, { href: it.href }, () => it.label),
              ),
          },
        )
    },
  })
}

describe('IrisBreadcrumb', () => {
  it('renders a <nav> with aria-label="Breadcrumb"', () => {
    const w = mount(buildHarness([{ label: 'Home' }]))
    expect(w.element.tagName).toBe('NAV')
    expect(w.attributes('aria-label')).toBe('Breadcrumb')
  })

  it('renders an <ol> with crumb items', () => {
    const w = mount(
      buildHarness([
        { href: '/', label: 'Home' },
        { href: '/x', label: 'Section' },
        { label: 'Current' },
      ]),
    )
    expect(w.find('ol').exists()).toBe(true)
    expect(w.findAll('[data-iris-breadcrumb-item]').length).toBe(3)
  })

  it('renders separators between but not after items', () => {
    const w = mount(
      buildHarness([
        { href: '/', label: 'A' },
        { href: '/x', label: 'B' },
        { label: 'C' },
      ]),
    )
    // 3 items → 2 separators
    expect(w.findAll('[data-iris-breadcrumb-separator]').length).toBe(2)
  })

  it('separators default to "/"', () => {
    const w = mount(buildHarness([{ href: '/', label: 'A' }, { label: 'B' }]))
    expect(w.find('[data-iris-breadcrumb-separator]').text()).toBe('/')
  })

  it('separator prop overrides default', () => {
    const Harness = defineComponent({
      setup() {
        return () =>
          h(IrisBreadcrumb, { separator: '›' }, {
            default: () => [
              h(IrisBreadcrumbItem, null, () => 'A'),
              h(IrisBreadcrumbItem, null, () => 'B'),
            ],
          })
      },
    })
    const w = mount(Harness)
    expect(w.find('[data-iris-breadcrumb-separator]').text()).toBe('›')
  })

  it('last item is marked aria-current="page"', () => {
    const w = mount(
      buildHarness([
        { href: '/', label: 'Home' },
        { label: 'Current' },
      ]),
    )
    const crumbs = w.findAll('[data-iris-breadcrumb-crumb]')
    expect(crumbs[0]!.attributes('aria-current')).toBeUndefined()
    expect(crumbs[1]!.attributes('aria-current')).toBe('page')
  })

  it('item with href renders an <a>', () => {
    const w = mount(
      buildHarness([
        { href: '/products', label: 'Products' },
        { label: 'Item' },
      ]),
    )
    const first = w.findAll('[data-iris-breadcrumb-crumb]')[0]!
    expect(first.element.tagName).toBe('A')
    expect(first.attributes('href')).toBe('/products')
  })

  it('the last item renders as <span> even if href is set', () => {
    const w = mount(
      buildHarness([
        { href: '/', label: 'Home' },
        { href: '/x', label: 'Last' },
      ]),
    )
    const lastCrumb = w.findAll('[data-iris-breadcrumb-crumb]').slice(-1)[0]!
    expect(lastCrumb.element.tagName).toBe('SPAN')
  })

  it('single item still has no separator', () => {
    const w = mount(buildHarness([{ label: 'Only' }]))
    expect(w.findAll('[data-iris-breadcrumb-separator]').length).toBe(0)
  })
})
