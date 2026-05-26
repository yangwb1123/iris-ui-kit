import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisDialog } from './Dialog'
import { IrisDialogTrigger } from './DialogTrigger'
import {
  IrisDialogClose,
  IrisDialogContent,
  IrisDialogDescription,
  IrisDialogTitle,
} from './DialogContent'
import { __getBodyScrollLockCount, __resetBodyScrollLock } from '../modal-utils'

enableAutoUnmount(afterEach)

function Harness(opts?: { defaultOpen?: boolean; controlledOpen?: import('vue').Ref<boolean> }) {
  const o = opts ?? {}
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisDialog,
          {
            defaultOpen: o.defaultOpen,
            open: o.controlledOpen?.value,
            ...(o.controlledOpen
              ? { 'onUpdate:open': (v: boolean) => (o.controlledOpen!.value = v) }
              : {}),
          },
          {
            default: () => [
              h(IrisDialogTrigger, null, () => 'Open'),
              h(IrisDialogContent, { teleport: false }, () => [
                h(IrisDialogTitle, null, () => 'Title'),
                h(IrisDialogDescription, null, () => 'Description text'),
                h('input', { class: 'first-input', type: 'text' }),
                h('button', { class: 'inner', type: 'button' }, 'Inner'),
                h(IrisDialogClose, null, () => 'Close'),
              ]),
            ],
          },
        )
    },
  })
}

describe('IrisDialog', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    __resetBodyScrollLock()
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
    __resetBodyScrollLock()
  })

  it('does not render content when closed', () => {
    const wrapper = mount(Harness(), { attachTo: host })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('opens on trigger click', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('renders backdrop with aria-modal="true"', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.find('[data-iris-dialog-backdrop]').exists()).toBe(true)
  })

  it('wires aria-labelledby and aria-describedby automatically', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const dialog = wrapper.find('[role="dialog"]')
    const labelledBy = dialog.attributes('aria-labelledby')
    const describedBy = dialog.attributes('aria-describedby')
    expect(labelledBy).toBeTruthy()
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Title')
    expect(document.getElementById(describedBy!)?.textContent).toBe('Description text')
  })

  it('IrisDialogClose closes the dialog', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    // Close button is the last button with text 'Close'
    const buttons = wrapper.findAll('button')
    const closeButton = buttons.find((b) => b.text() === 'Close')
    expect(closeButton).toBeDefined()
    await closeButton!.trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('closes on Escape when closeOnEscape is enabled (default)', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('closes on backdrop pointerdown', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const backdrop = wrapper.find('[data-iris-dialog-backdrop]').element as HTMLElement
    const event = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(event, 'target', { value: backdrop })
    Object.defineProperty(event, 'currentTarget', { value: backdrop })
    backdrop.dispatchEvent(event)
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('does NOT close when pointerdown is inside content', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const content = wrapper.find('[role="dialog"]').element as HTMLElement
    content.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('respects closeOnEscape=false', async () => {
    const NoEscape = defineComponent({
      setup() {
        return () =>
          h(
            IrisDialog,
            { defaultOpen: true, closeOnEscape: false },
            {
              default: () => [
                h(IrisDialogTrigger, null, () => 'T'),
                h(IrisDialogContent, { teleport: false }, () => 'Body'),
              ],
            },
          )
      },
    })
    const wrapper = mount(NoEscape, { attachTo: host })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('locks body scroll while open', async () => {
    expect(__getBodyScrollLockCount()).toBe(0)
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(__getBodyScrollLockCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
    await nextTick()
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('controlled mode: setOpen emits update:open', async () => {
    const open = ref(false)
    const wrapper = mount(Harness({ controlledOpen: open }), { attachTo: host })
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    await nextTick()
    expect(open.value).toBe(true)
  })

  it('Trigger throws outside a Dialog', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mount(defineComponent({ setup: () => () => h(IrisDialogTrigger) }))).toThrow(
      /IrisDialogTrigger/,
    )
    warn.mockRestore()
  })

  it('Content throws outside a Dialog', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mount(defineComponent({ setup: () => () => h(IrisDialogContent) }))).toThrow(
      /IrisDialogContent/,
    )
    warn.mockRestore()
  })
})
