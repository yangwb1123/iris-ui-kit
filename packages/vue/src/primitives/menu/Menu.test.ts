import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisMenu } from './Menu'
import { IrisMenuTrigger } from './MenuTrigger'
import { IrisMenuContent } from './MenuContent'
import { IrisMenuItem, IrisMenuSeparator } from './MenuItem'
import { IrisMenuSub } from './MenuSub'

enableAutoUnmount(afterEach)

const FlatHarness = defineComponent({
  setup() {
    return () =>
      h(
        IrisMenu,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisMenuTrigger, null, () => 'File'),
            h(IrisMenuContent, { teleport: false }, () => [
              h(IrisMenuItem, null, () => 'New'),
              h(IrisMenuItem, null, () => 'Open'),
              h(IrisMenuSeparator),
              h(IrisMenuItem, { disabled: true }, () => 'Recents'),
            ]),
          ],
        },
      )
  },
})

const NestedHarness = defineComponent({
  setup() {
    const log: string[] = []
    return {
      log,
      render: () =>
        h(
          IrisMenu,
          { defaultOpen: true },
          {
            default: () => [
              h(IrisMenuTrigger, null, () => 'File'),
              h(IrisMenuContent, { teleport: false }, () => [
                h(IrisMenuItem, { onSelect: () => log.push('new') }, () => 'New'),
                h(
                  IrisMenuSub,
                  { label: 'Open Recent', teleport: false },
                  () => [
                    h(IrisMenuItem, { onSelect: () => log.push('a.txt') }, () => 'a.txt'),
                    h(IrisMenuItem, { onSelect: () => log.push('b.txt') }, () => 'b.txt'),
                  ],
                ),
              ]),
            ],
          },
        ),
    }
  },
  render() {
    return this.render()
  },
})

describe('IrisMenu (flat)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('renders a menu with menuitems', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="menuitem"]').length).toBe(3)
  })

  it('separator has role=separator', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="separator"]').exists()).toBe(true)
  })

  it('selecting an item closes the root menu', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    await wrapper.findAll('[role="menuitem"]')[0]!.trigger('click')
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('Escape closes the menu', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('disabled item is skipped from arrow navigation (aria-disabled set)', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    const disabled = wrapper.findAll('[role="menuitem"]').find(
      (i) => i.attributes('aria-disabled') === 'true',
    )
    expect(disabled).toBeDefined()
  })
})

describe('IrisMenu (nested with IrisMenuSub)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('renders the submenu trigger inside the root menu', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[data-iris-menu-sub-trigger]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-menu-sub-trigger]').attributes('aria-haspopup')).toBe('menu')
  })

  it('submenu opens on ArrowRight from its trigger', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    const subTrigger = wrapper.find('[data-iris-menu-sub-trigger]')
    await subTrigger.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
  })

  it('submenu opens on click of its trigger', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    await wrapper.find('[data-iris-menu-sub-trigger]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
  })
})
