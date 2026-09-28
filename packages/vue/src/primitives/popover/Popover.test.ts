import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, nextTick, ref, watchEffect } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { IrisButton } from '../button/Button'
import { IrisPopover } from './Popover'
import { IrisPopoverTrigger } from './PopoverTrigger'
import { IrisPopoverContent } from './PopoverContent'
import { IrisDialog } from '../dialog/Dialog'
import { IrisDialogContent } from '../dialog/DialogContent'
import { PopoverContextKey } from './context'

const NestedDialogHarness = defineComponent({
  setup() {
    const confirmed = ref(false)
    return {
      confirmed,
      render: () =>
        h(
          IrisPopover,
          { defaultOpen: true },
          {
            default: () => [
              h(IrisPopoverTrigger, null, () => 'Trigger'),
              h(IrisPopoverContent, { 'data-testid': 'popover-content' }, () =>
                h(
                  IrisDialog,
                  { open: true, 'onUpdate:open': () => undefined },
                  {
                    default: () =>
                      h(IrisDialogContent, { 'data-testid': 'dialog-content' }, () =>
                        h('button', { onClick: () => (confirmed.value = true) }, 'Confirm'),
                      ),
                  },
                ),
              ),
            ],
          },
        ),
    }
  },
  render() {
    return this.render()
  },
})

function Harness(slotConfig?: {
  triggerLabel?: string
  contentText?: string
  defaultOpen?: boolean
  controlledOpen?: import('vue').Ref<boolean>
  autoFocus?: boolean
  restoreFocus?: boolean
  placement?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const opts = slotConfig ?? {}
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisPopover,
          {
            defaultOpen: opts.defaultOpen,
            open: opts.controlledOpen?.value,
            placement: opts.placement ?? 'bottom',
            ...(opts.controlledOpen
              ? { 'onUpdate:open': (v: boolean) => (opts.controlledOpen!.value = v) }
              : {}),
          },
          {
            default: () => [
              h(IrisPopoverTrigger, null, () => opts.triggerLabel ?? 'Trigger'),
              h(
                IrisPopoverContent,
                {
                  teleport: false,
                  ...(opts.autoFocus === undefined ? {} : { autoFocus: opts.autoFocus }),
                  ...(opts.restoreFocus === undefined ? {} : { restoreFocus: opts.restoreFocus }),
                },
                () => opts.contentText ?? 'Content',
              ),
            ],
          },
        )
    },
  })
}

describe('IrisPopover', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
  })

  it('does not render content when closed', () => {
    const wrapper = mount(Harness(), { attachTo: host })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('Trigger')
  })

  it('opens on trigger click', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('focuses content on open and restores focus on close by default', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    const trigger = wrapper.find('[aria-haspopup="dialog"]')
    const triggerElement = trigger.element as HTMLElement
    triggerElement.focus()

    await trigger.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)

    await trigger.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(triggerElement)
  })

  it('does not auto-focus content when autoFocus is false', async () => {
    const wrapper = mount(Harness({ autoFocus: false }), { attachTo: host })
    const trigger = wrapper.find('[aria-haspopup="dialog"]')
    const triggerElement = trigger.element as HTMLElement
    triggerElement.focus()

    await trigger.trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(document.activeElement).toBe(triggerElement)
  })

  it('does not restore focus when restoreFocus is false', async () => {
    const wrapper = mount(Harness({ restoreFocus: false }), { attachTo: host })
    const trigger = wrapper.find('[aria-haspopup="dialog"]')
    const triggerElement = trigger.element as HTMLElement
    triggerElement.focus()

    await trigger.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)

    const other = document.createElement('button')
    host.appendChild(other)
    other.focus()
    await trigger.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(other)
    expect(document.activeElement).not.toBe(triggerElement)
  })

  it('resolves an as-child component trigger to its root HTMLElement', async () => {
    let observedTrigger: HTMLElement | null = null
    const TriggerRefProbe = defineComponent({
      setup() {
        const ctx = inject(PopoverContextKey)
        if (!ctx) throw new Error('missing popover context')
        watchEffect(() => {
          observedTrigger = ctx.triggerRef.value
        })
        return () => null
      },
    })
    const ComponentTriggerHarness = defineComponent({
      setup() {
        return () =>
          h(IrisPopover, null, {
            default: () => [
              h(IrisPopoverTrigger, { asChild: true }, () => [
                h(IrisButton, { variant: 'outline' }, () => 'Component trigger'),
              ]),
              h(TriggerRefProbe),
              h(IrisPopoverContent, { teleport: false }, () => 'Panel'),
            ],
          })
      },
    })

    const wrapper = mount(ComponentTriggerHarness, { attachTo: host })
    await nextTick()
    const trigger = wrapper.get('button').element as HTMLButtonElement
    expect(observedTrigger).toBe(trigger)
    expect(observedTrigger).toBeInstanceOf(HTMLElement)

    const rectSpy = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 10,
      width: 120,
      height: 32,
      top: 10,
      right: 140,
      bottom: 42,
      left: 20,
      toJSON: () => ({}),
    } as DOMRect)

    trigger.focus()
    await wrapper.get('button').trigger('click')
    await nextTick()
    await flushPromises()
    const content = wrapper.get('[role="dialog"]').element as HTMLElement
    expect(rectSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(content)

    // The trigger is excluded from outside-dismiss checks. This specifically
    // exercises HTMLElement.contains() on the captured ref.
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
    outside.remove()
    wrapper.unmount()
  })

  it('closes on a second trigger click (toggle)', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('sets aria-expanded and aria-controls on the trigger', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    const trigger = wrapper.find('[aria-haspopup="dialog"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-controls')).toBeTruthy()
    await trigger.trigger('click')
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  it('closes on Escape key', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('closes on outside pointerdown', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const event = new Event('pointerdown', { bubbles: true })
    outside.dispatchEvent(event)
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    outside.remove()
  })

  it('does NOT close when clicking inside the content', async () => {
    const wrapper = mount(Harness({ defaultOpen: true }), { attachTo: host })
    await nextTick()
    const content = wrapper.find('[role="dialog"]').element as HTMLElement
    content.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('keeps a teleported dialog content inside its ancestor popover', async () => {
    const wrapper = mount(NestedDialogHarness, { attachTo: host })
    await nextTick()
    await flushPromises()

    const popover = document.querySelector('[data-testid="popover-content"]')
    const dialog = document.querySelector('[data-testid="dialog-content"]') as HTMLElement | null
    expect(popover).not.toBeNull()
    expect(dialog).not.toBeNull()

    dialog?.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(document.querySelector('[data-testid="popover-content"]')).not.toBeNull()

    dialog
      ?.querySelector('button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(wrapper.vm.confirmed).toBe(true)
    wrapper.unmount()
  })

  it('controlled mode: opens when prop flips true', async () => {
    const controlled = ref(false)
    const wrapper = mount(Harness({ controlledOpen: controlled }), { attachTo: host })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    controlled.value = true
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('controlled mode: emits update:open on toggle', async () => {
    const controlled = ref(false)
    const events: boolean[] = []
    const Listener = defineComponent({
      setup() {
        return () =>
          h(
            IrisPopover,
            {
              open: controlled.value,
              'onUpdate:open': (v: boolean) => {
                events.push(v)
                controlled.value = v
              },
            },
            {
              default: () => [
                h(IrisPopoverTrigger, null, () => 'T'),
                h(IrisPopoverContent, { teleport: false }, () => 'C'),
              ],
            },
          )
      },
    })
    const wrapper = mount(Listener, { attachTo: host })
    await wrapper.find('[aria-haspopup="dialog"]').trigger('click')
    await nextTick()
    expect(events).toEqual([true])
  })

  it('Trigger throws outside a Popover', () => {
    const Bad = defineComponent({ setup: () => () => h(IrisPopoverTrigger) })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mount(Bad)).toThrow(/IrisPopoverTrigger must be a descendant/)
    warn.mockRestore()
  })

  it('Content throws outside a Popover', () => {
    const Bad = defineComponent({ setup: () => () => h(IrisPopoverContent) })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mount(Bad)).toThrow(/IrisPopoverContent must be a descendant/)
    warn.mockRestore()
  })
})
