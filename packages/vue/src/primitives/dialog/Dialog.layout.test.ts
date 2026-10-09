import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisDialog } from './Dialog'
import { IrisDialogContent, IrisDialogTitle } from './DialogContent'
import { __getBodyScrollLockCount, __resetBodyScrollLock } from '../modal-utils'

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

function sized(props: Record<string, unknown>) {
  return defineComponent({
    setup() {
      return () =>
        h(
          IrisDialog,
          { defaultOpen: true },
          {
            default: () => [
              h(IrisDialogContent, { teleport: false, ...props }, () => [
                h(IrisDialogTitle, null, () => 'Title'),
                h('input', { type: 'text' }),
              ]),
            ],
          },
        )
    },
  })
}

async function openSized(props: Record<string, unknown> = {}) {
  const wrapper = mount(sized(props), { attachTo: host })
  await nextTick()
  return wrapper.find('[role="dialog"]')
}

describe('IrisDialogContent sizing', () => {
  it('renders content-sized by default (legacy geometry)', async () => {
    const surface = await openSized()
    const style = surface.attributes('style')
    expect(style).not.toMatch(/(^|;)\s*width:/)
    expect(style).toContain('max-width: 90vw')
    expect(style).toContain('max-height: 85vh')
    expect(surface.attributes('data-iris-dialog-size')).toBeUndefined()
  })

  it('maps every size preset to its width', async () => {
    for (const [size, width] of Object.entries({
      sm: '32rem',
      md: '40rem',
      lg: '50rem',
      xl: '60rem',
    })) {
      const surface = await openSized({ size })
      const style = surface.attributes('style')
      expect(style).toContain(`width: ${width}`)
      expect(surface.attributes('data-iris-dialog-size')).toBe(size)
      expect(style).toContain('max-width: calc(100vw - 48px)')
      expect(style).toContain('box-sizing: border-box')
    }
  })

  it('an explicit width overrides the preset and numbers read as px', async () => {
    const surface = await openSized({ size: 'sm', width: '70vw' })
    expect(surface.attributes('style')).toContain('width: 70vw')
    const px = await openSized({ width: 720 })
    expect(px.attributes('style')).toContain('width: 720px')
  })

  it('rejects invalid dimensions and falls back to the preset / defaults', async () => {
    const fallback = await openSized({ size: 'lg', width: Number.NaN, maxHeight: -1 })
    expect(fallback.attributes('style')).toContain('width: 50rem')
    expect(fallback.attributes('style')).toContain('max-height: min(85vh, calc(100vh - 48px))')

    const legacy = await openSized({ width: Number.POSITIVE_INFINITY })
    expect(legacy.attributes('style')).not.toMatch(/(^|;)\s*width:/)
    expect(legacy.attributes('style')).toContain('max-width: 90vw')
  })

  it('honors a custom maxHeight', async () => {
    const surface = await openSized({ size: 'md', maxHeight: 400 })
    expect(surface.attributes('style')).toContain('max-height: min(400px, calc(100vh - 48px))')
  })

  it('keeps Escape, backdrop dismiss, scroll lock and ARIA on a sized dialog', async () => {
    const wrapper = mount(sized({ size: 'lg' }), { attachTo: host })
    await nextTick()
    const surface = wrapper.find('[role="dialog"]')
    expect(surface.attributes('aria-modal')).toBe('true')
    expect(surface.attributes('aria-labelledby')).toBe(
      document.getElementById(surface.attributes('aria-labelledby')!)?.id,
    )
    expect(__getBodyScrollLockCount()).toBe(1)

    const backdrop = wrapper.find('[data-iris-dialog-backdrop]').element as HTMLElement
    const event = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(event, 'target', { value: backdrop })
    Object.defineProperty(event, 'currentTarget', { value: backdrop })
    backdrop.dispatchEvent(event)
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('still closes on Escape when sized', async () => {
    const onUpdate = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(
              IrisDialog,
              { defaultOpen: true, 'onUpdate:open': onUpdate },
              {
                default: () => [
                  h(IrisDialogContent, { teleport: false, size: 'xl' }, () => 'Body'),
                ],
              },
            )
        },
      }),
      { attachTo: host },
    )
    await nextTick()
    expect(wrapper.find('[role="dialog"]').attributes('style')).toContain('width: 60rem')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(onUpdate).toHaveBeenCalledWith(false)
  })
})
