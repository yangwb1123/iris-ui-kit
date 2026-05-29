import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisDrawer } from './Drawer'
import { IrisDrawerTrigger } from './DrawerTrigger'
import { IrisDrawerClose, IrisDrawerContent, IrisDrawerTitle } from './DrawerContent'
import { __getBodyScrollLockCount, __resetBodyScrollLock } from '../modal-utils'

enableAutoUnmount(afterEach)

function Harness(opts?: { defaultOpen?: boolean; side?: 'left' | 'right' | 'top' | 'bottom' }) {
  const o = opts ?? {}
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisDrawer,
          { defaultOpen: o.defaultOpen, side: o.side },
          {
            default: () => [
              h(IrisDrawerTrigger, null, () => 'open'),
              h(IrisDrawerContent, null, {
                default: () => [
                  h(IrisDrawerTitle, null, () => 'Settings'),
                  h('p', null, 'body'),
                  h(IrisDrawerClose, null, () => 'x'),
                ],
              }),
            ],
          },
        )
    },
  })
}

describe('IrisDrawer', () => {
  beforeEach(() => __resetBodyScrollLock())
  afterEach(() => __resetBodyScrollLock())

  it('is closed by default — backdrop not rendered', () => {
    const wrapper = mount(Harness())
    expect(document.querySelector('[data-iris-drawer-backdrop]')).toBeNull()
    expect(wrapper.find('[data-iris-drawer-trigger]').exists()).toBe(true)
  })

  it('opens after clicking the trigger', async () => {
    const wrapper = mount(Harness())
    await wrapper.find('[data-iris-drawer-trigger]').trigger('click')
    await nextTick()
    await new Promise((r) => requestAnimationFrame(r))
    const backdrop = document.querySelector('[data-iris-drawer-backdrop]')
    expect(backdrop).not.toBeNull()
    expect(backdrop?.getAttribute('data-state')).toBe('open')
  })

  it('aria-expanded on trigger reflects open state', async () => {
    const wrapper = mount(Harness())
    const trigger = wrapper.find('[data-iris-drawer-trigger]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('renders content with role="dialog" and aria-modal', async () => {
    mount(Harness({ defaultOpen: true }))
    await nextTick()
    const content = document.querySelector('[data-iris-drawer-content]')
    expect(content?.getAttribute('role')).toBe('dialog')
    expect(content?.getAttribute('aria-modal')).toBe('true')
  })

  it('aria-labelledby points at the Title id when one is present', async () => {
    mount(Harness({ defaultOpen: true }))
    await nextTick()
    const content = document.querySelector('[data-iris-drawer-content]')
    const title = document.querySelector('[data-iris-drawer-title]')
    expect(content?.getAttribute('aria-labelledby')).toBe(title?.getAttribute('id'))
  })

  it('IrisDrawerClose closes the drawer', async () => {
    mount(Harness({ defaultOpen: true }))
    await nextTick()
    const close = document.querySelector('[data-iris-drawer-close]') as HTMLElement
    expect(close).not.toBeNull()
    close.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    // Backdrop is still mounted during the exit animation, but visible='closed'
    const backdrop = document.querySelector('[data-iris-drawer-backdrop]')
    expect(backdrop?.getAttribute('data-state')).toBe('closed')
  })

  it('Escape closes when closeOnEscape (default true)', async () => {
    mount(Harness({ defaultOpen: true }))
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    const backdrop = document.querySelector('[data-iris-drawer-backdrop]')
    expect(backdrop?.getAttribute('data-state')).toBe('closed')
  })

  it('side="left" sets data-iris-drawer-side="left"', async () => {
    mount(Harness({ defaultOpen: true, side: 'left' }))
    await nextTick()
    const content = document.querySelector('[data-iris-drawer-content]')
    expect(content?.getAttribute('data-iris-drawer-side')).toBe('left')
  })

  it('body scroll is locked while open and released on close', async () => {
    mount(Harness({ defaultOpen: true }))
    await nextTick()
    expect(__getBodyScrollLockCount()).toBe(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('controlled mode honors v-model:open and emits update:open', async () => {
    const open = ref(false)
    const onUpdate = vi.fn((v: boolean) => {
      open.value = v
    })
    const Comp = defineComponent({
      setup() {
        return () =>
          h(
            IrisDrawer,
            { open: open.value, 'onUpdate:open': onUpdate },
            {
              default: () => [
                h(IrisDrawerTrigger, null, () => 'open'),
                h(IrisDrawerContent, null, () => h('p', null, 'body')),
              ],
            },
          )
      },
    })
    const wrapper = mount(Comp)
    await wrapper.find('[data-iris-drawer-trigger]').trigger('click')
    expect(onUpdate).toHaveBeenCalledWith(true)
  })

  it('clicking the backdrop closes (when closeOnOutsideClick=true, default)', async () => {
    mount(Harness({ defaultOpen: true }))
    await nextTick()
    const backdrop = document.querySelector('[data-iris-drawer-backdrop]') as HTMLElement
    // Simulate a click whose target IS the backdrop itself.
    const evt = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: backdrop })
    Object.defineProperty(evt, 'currentTarget', { value: backdrop })
    backdrop.dispatchEvent(evt)
    await nextTick()
    expect(backdrop.getAttribute('data-state')).toBe('closed')
  })
})
