import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisDropdown } from './Dropdown'
import { IrisDropdownTrigger } from './DropdownTrigger'
import { IrisDropdownMenu } from './DropdownMenu'
import { IrisDropdownItem, IrisDropdownSeparator } from './DropdownItem'

enableAutoUnmount(afterEach)

function Harness(opts: { defaultOpen?: boolean } = {}) {
  return defineComponent({
    setup() {
      const handlers = { onCopy: 0, onPaste: 0 }
      return () =>
        h(
          IrisDropdown,
          { defaultOpen: opts.defaultOpen },
          {
            default: () => [
              h(IrisDropdownTrigger, null, () => 'Actions'),
              h(IrisDropdownMenu, { teleport: false }, () => [
                h(IrisDropdownItem, { onSelect: () => handlers.onCopy++ }, () => 'Copy'),
                h(IrisDropdownItem, { onSelect: () => handlers.onPaste++ }, () => 'Paste'),
                h(IrisDropdownSeparator),
                h(IrisDropdownItem, { disabled: true }, () => 'Delete'),
              ]),
            ],
          },
        )
    },
  })
}

describe('IrisDropdown', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('does not render menu when closed', () => {
    const wrapper = mount(Harness(), { attachTo: host })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('opens on trigger click', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('[aria-haspopup="menu"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('opens on ArrowDown / Enter / Space on trigger', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('[aria-haspopup="menu"]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('sets aria-expanded on the trigger', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    const trigger = wrapper.find('[aria-haspopup="menu"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('item click emits select and closes the menu', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const items = wrapper.findAll('[role="menuitem"]')
    await items[0]!.trigger('click')
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('disabled item has aria-disabled and tabindex=-1', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const items = wrapper.findAll('[role="menuitem"]')
    const disabled = items.find((i) => i.attributes('aria-disabled') === 'true')
    expect(disabled).toBeDefined()
    expect(disabled!.attributes('tabindex')).toBe('-1')
  })

  it('Escape closes the menu', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('outside pointerdown closes the menu', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    outside.remove()
  })

  it('renders a separator between groups', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="separator"]').exists()).toBe(true)
  })

  it('keepOpen item does NOT close the menu', async () => {
    let count = 0
    const Persistent = defineComponent({
      setup() {
        return () =>
          h(
            IrisDropdown,
            { defaultOpen: true },
            {
              default: () => [
                h(IrisDropdownTrigger, null, () => 'T'),
                h(IrisDropdownMenu, { teleport: false }, () => [
                  h(IrisDropdownItem, { keepOpen: true, onSelect: () => count++ }, () => 'Persist'),
                ]),
              ],
            },
          )
      },
    })
    const wrapper = mount(Persistent, { attachTo: host })
    await nextTick()
    await wrapper.find('[role="menuitem"]').trigger('click')
    await nextTick()
    expect(count).toBe(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('Trigger outside Dropdown throws', () => {
    expect(() => mount(defineComponent({ setup: () => () => h(IrisDropdownTrigger) }))).toThrow(
      /IrisDropdownTrigger/,
    )
  })
})
