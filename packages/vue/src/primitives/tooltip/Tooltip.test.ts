import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisTooltip } from './Tooltip'

function Harness(extraProps: Record<string, unknown> = {}) {
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisTooltip,
          {
            content: 'hello',
            openDelay: 0,
            closeDelay: 0,
            teleport: false,
            ...extraProps,
          },
          { default: () => h('button', { class: 'trigger', type: 'button' }, 'T') },
        )
    },
  })
}

describe('IrisTooltip', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    host.remove()
  })

  it('does not render the tooltip when closed', () => {
    const wrapper = mount(Harness(), { attachTo: host })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('opens on pointerenter (with zero delay)', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('.trigger').trigger('pointerenter')
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
    expect(wrapper.find('[role="tooltip"]').text()).toBe('hello')
  })

  it('closes on pointerleave (with zero delay)', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('.trigger').trigger('pointerenter')
    await nextTick()
    await wrapper.find('.trigger').trigger('pointerleave')
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('opens on focus, closes on blur', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('.trigger').trigger('focus')
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
    await wrapper.find('.trigger').trigger('blur')
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('respects openDelay (does not open before the timeout)', async () => {
    const wrapper = mount(Harness({ openDelay: 300 }), { attachTo: host })
    await wrapper.find('.trigger').trigger('pointerenter')
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    vi.advanceTimersByTime(299)
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    vi.advanceTimersByTime(2)
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
  })

  it('cancels pending open when pointerleave occurs before the openDelay elapses', async () => {
    const wrapper = mount(Harness({ openDelay: 300 }), { attachTo: host })
    await wrapper.find('.trigger').trigger('pointerenter')
    vi.advanceTimersByTime(150)
    await wrapper.find('.trigger').trigger('pointerleave')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('sets aria-describedby on the trigger only while open', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    const trigger = wrapper.find('.trigger')
    expect(trigger.attributes('aria-describedby')).toBeUndefined()
    await trigger.trigger('pointerenter')
    await nextTick()
    expect(trigger.attributes('aria-describedby')).toBeTruthy()
    await trigger.trigger('pointerleave')
    await nextTick()
    expect(trigger.attributes('aria-describedby')).toBeUndefined()
  })

  it('Escape closes immediately', async () => {
    const wrapper = mount(Harness({ closeDelay: 500 }), { attachTo: host })
    await wrapper.find('.trigger').trigger('pointerenter')
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('disabled prop suppresses opening', async () => {
    const wrapper = mount(Harness({ disabled: true }), { attachTo: host })
    await wrapper.find('.trigger').trigger('pointerenter')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('content slot wins over content prop', async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            IrisTooltip,
            { content: 'plain', openDelay: 0, teleport: false },
            {
              default: () => h('button', { class: 'trigger', type: 'button' }, 'T'),
              content: () => h('span', { class: 'rich' }, 'rich!'),
            },
          ),
      }),
      { attachTo: host },
    )
    await wrapper.find('.trigger').trigger('pointerenter')
    await nextTick()
    expect(wrapper.find('.rich').exists()).toBe(true)
    expect(wrapper.find('[role="tooltip"]').text()).toBe('rich!')
  })

  it('warns when no trigger child is provided', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(
      defineComponent({
        setup: () => () => h(IrisTooltip, { content: 'x', teleport: false }),
      }),
      { attachTo: host },
    )
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
