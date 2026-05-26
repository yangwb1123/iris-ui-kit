import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisSidebarLayout } from './SidebarLayout'
import { IrisHeaderLayout } from './HeaderLayout'
import { IrisDashboardCard, IrisDashboardGrid } from './DashboardGrid'

describe('IrisSidebarLayout', () => {
  it('renders sidebar and main slots', () => {
    const wrapper = mount(IrisSidebarLayout, {
      slots: {
        sidebar: () => h('nav', { class: 'side' }, 'NAV'),
        default: () => h('section', { class: 'main' }, 'MAIN'),
      },
    })
    expect(wrapper.find('.side').exists()).toBe(true)
    expect(wrapper.find('.main').exists()).toBe(true)
  })

  it('default-collapsed sets the sidebar width to collapsedWidth', () => {
    const wrapper = mount(IrisSidebarLayout, {
      props: { defaultCollapsed: true, collapsedWidth: 60 },
      slots: { sidebar: () => 'x' },
    })
    expect(wrapper.find('[data-iris-sidebar]').attributes('style')).toContain('60px')
    expect(wrapper.attributes('data-collapsed')).toBe('')
  })

  it('controlled `collapsed` prop drives the state', async () => {
    const collapsed = ref(false)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(
            IrisSidebarLayout,
            {
              collapsed: collapsed.value,
              'onUpdate:collapsed': (v: boolean) => (collapsed.value = v),
            },
            { sidebar: () => 'x' },
          )
      },
    })
    const wrapper = mount(Harness)
    expect(wrapper.attributes('data-collapsed')).toBeUndefined()
    collapsed.value = true
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('data-collapsed')).toBe('')
  })

  it('side="right" reverses flex direction', () => {
    const wrapper = mount(IrisSidebarLayout, {
      props: { side: 'right' },
      slots: { sidebar: () => 'x' },
    })
    expect(wrapper.attributes('data-side')).toBe('right')
    expect(wrapper.attributes('style')).toContain('row-reverse')
  })
})

describe('IrisHeaderLayout', () => {
  it('renders header + main when both slots provided', () => {
    const wrapper = mount(IrisHeaderLayout, {
      slots: {
        header: () => h('h1', { class: 'h' }, 'H'),
        default: () => h('div', { class: 'm' }, 'M'),
      },
    })
    expect(wrapper.find('[data-iris-header] .h').exists()).toBe(true)
    expect(wrapper.find('[data-iris-header-main] .m').exists()).toBe(true)
  })

  it('omits header when slot is empty', () => {
    const wrapper = mount(IrisHeaderLayout, {
      slots: { default: () => 'main' },
    })
    expect(wrapper.find('[data-iris-header]').exists()).toBe(false)
  })

  it('sticky=true sets position: sticky on header', () => {
    const wrapper = mount(IrisHeaderLayout, {
      props: { sticky: true },
      slots: { header: () => 'h' },
    })
    expect(wrapper.find('[data-iris-header]').attributes('style')).toContain('position: sticky')
  })

  it('renders footer when slot is provided', () => {
    const wrapper = mount(IrisHeaderLayout, {
      slots: { footer: () => h('span', { class: 'foo' }, 'F') },
    })
    expect(wrapper.find('[data-iris-footer] .foo').exists()).toBe(true)
  })
})

describe('IrisDashboardGrid', () => {
  it('renders a CSS grid with `repeat(N, 1fr)` by default', () => {
    const wrapper = mount(IrisDashboardGrid, {
      props: { columns: 4 },
      slots: { default: () => h(IrisDashboardCard, null, () => 'X') },
    })
    expect(wrapper.attributes('style')).toContain('repeat(4, 1fr)')
  })

  it('switches to auto-fill when minColWidth is set', () => {
    const wrapper = mount(IrisDashboardGrid, {
      props: { minColWidth: 200 },
      slots: { default: () => h(IrisDashboardCard, null, () => 'X') },
    })
    expect(wrapper.attributes('style')).toContain('auto-fill')
    expect(wrapper.attributes('style')).toContain('200px')
  })

  it('IrisDashboardCard applies col-span', () => {
    const wrapper = mount(IrisDashboardCard, {
      props: { colSpan: 3 },
      slots: { default: () => 'x' },
    })
    expect(wrapper.attributes('style')).toContain('grid-column: span 3')
  })

  it('col-span="full" spans 1 / -1', () => {
    const wrapper = mount(IrisDashboardCard, {
      props: { colSpan: 'full' },
      slots: { default: () => 'x' },
    })
    expect(wrapper.attributes('style')).toContain('grid-column: 1 / -1')
  })

  it('surface=false strips background and border', () => {
    const wrapper = mount(IrisDashboardCard, {
      props: { surface: false },
      slots: { default: () => 'x' },
    })
    const style = wrapper.attributes('style') ?? ''
    expect(style).toContain('background: transparent')
    expect(style).not.toContain('var(--iris-border)')
  })
})
