import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { IrisAlert } from './Alert'

describe('IrisAlert', () => {
  it('renders the default slot', () => {
    const w = mount(IrisAlert, { slots: { default: 'message' } })
    expect(w.text()).toContain('message')
  })

  it('exposes data-iris-alert-tone', () => {
    const w = mount(IrisAlert, { props: { tone: 'success' } })
    expect(w.attributes('data-iris-alert-tone')).toBe('success')
  })

  it('uses role="alert" for warning/danger, "status" otherwise', () => {
    expect(mount(IrisAlert, { props: { tone: 'info' } }).attributes('role')).toBe('status')
    expect(mount(IrisAlert, { props: { tone: 'success' } }).attributes('role')).toBe('status')
    expect(mount(IrisAlert, { props: { tone: 'warning' } }).attributes('role')).toBe('alert')
    expect(mount(IrisAlert, { props: { tone: 'danger' } }).attributes('role')).toBe('alert')
  })

  it('renders the title prop', () => {
    const w = mount(IrisAlert, { props: { title: 'Heads up' } })
    expect(w.find('[data-iris-alert-title]').exists()).toBe(true)
    expect(w.find('[data-iris-alert-title]').text()).toBe('Heads up')
  })

  it('title slot wins over the title prop', () => {
    const w = mount(IrisAlert, {
      props: { title: 'fallback' },
      slots: { title: 'slot wins' },
    })
    expect(w.find('[data-iris-alert-title]').text()).toBe('slot wins')
  })

  it('omits the title element when neither title nor slot is given', () => {
    const w = mount(IrisAlert, { slots: { default: 'body' } })
    expect(w.find('[data-iris-alert-title]').exists()).toBe(false)
  })

  it('renders the icon slot when supplied', () => {
    const w = mount(IrisAlert, { slots: { icon: 'X', default: 'b' } })
    expect(w.find('[data-iris-alert-icon]').exists()).toBe(true)
    expect(w.find('[data-iris-alert-icon]').text()).toBe('X')
  })

  it('no close button by default', () => {
    const w = mount(IrisAlert, { slots: { default: 'body' } })
    expect(w.find('[data-iris-alert-close]').exists()).toBe(false)
  })

  it('closable=true renders a close button that emits close + update:open', async () => {
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    const w = mount(IrisAlert, {
      props: { closable: true },
      slots: { default: 'body' },
      attrs: { onClose, 'onUpdate:open': onUpdate },
    })
    await w.find('[data-iris-alert-close]').trigger('click')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(false)
  })

  it('uncontrolled close hides the alert (returns null)', async () => {
    const w = mount(IrisAlert, { props: { closable: true }, slots: { default: 'body' } })
    expect(w.find('[data-iris-alert]').exists()).toBe(true)
    await w.find('[data-iris-alert-close]').trigger('click')
    expect(w.find('[data-iris-alert]').exists()).toBe(false)
  })

  it('controlled mode does not auto-hide on close — parent must update v-model', async () => {
    const Comp = defineComponent({
      setup() {
        const open = ref(true)
        return () =>
          h(IrisAlert, {
            open: open.value,
            closable: true,
            'onUpdate:open': () => {
              // intentionally ignored — verifying that without parent update, alert stays
            },
          })
      },
    })
    const w = mount(Comp)
    expect(w.find('[data-iris-alert]').exists()).toBe(true)
    await w.find('[data-iris-alert-close]').trigger('click')
    // Parent didn't update → still visible.
    expect(w.find('[data-iris-alert]').exists()).toBe(true)
  })
})
