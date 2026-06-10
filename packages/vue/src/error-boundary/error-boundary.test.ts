import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisErrorBoundary } from './IrisErrorBoundary'

// A child that throws on render until `boom` flips false — lets us exercise the
// reset()/recovery path with a now-fixed child.
const boom = ref(true)
const Boom = defineComponent({
  name: 'Boom',
  setup() {
    return () => {
      if (boom.value) throw new Error('kaboom')
      return h('div', { 'data-ok': '' }, 'recovered')
    }
  },
})

describe('IrisErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    boom.value = true
    // Vue logs the captured error to console.error; silence the expected noise.
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('shows the default fallback (role=alert, thrown message) without crashing', async () => {
    const w = mount(IrisErrorBoundary, { slots: { default: () => h(Boom) } })
    await nextTick()

    const alert = w.find('[data-iris-error-boundary]')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('role')).toBe('alert')
    expect(w.find('[data-iris-error-boundary-message]').text()).toBe('kaboom')
    expect(w.find('[data-iris-error-boundary-retry]').exists()).toBe(true)
  })

  it('calls onError with the caught error', () => {
    const onError = vi.fn()
    mount(IrisErrorBoundary, {
      props: { onError },
      slots: { default: () => h(Boom) },
    })

    expect(onError).toHaveBeenCalledTimes(1)
    const [err] = onError.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('kaboom')
  })

  it('reset() lets a now-fixed child render again', async () => {
    const w = mount(IrisErrorBoundary, { slots: { default: () => h(Boom) } })
    await nextTick()
    expect(w.find('[data-iris-error-boundary]').exists()).toBe(true)

    // Fix the child, then trigger reset() via the retry button.
    boom.value = false
    await w.find('[data-iris-error-boundary-retry]').trigger('click')

    expect(w.find('[data-iris-error-boundary]').exists()).toBe(false)
    expect(w.find('[data-ok]').text()).toBe('recovered')
  })

  it('passes { error, reset } to a custom #fallback slot', async () => {
    const w = mount(IrisErrorBoundary, {
      slots: {
        default: () => h(Boom),
        fallback: ({ error, reset }: { error: unknown; reset: () => void }) =>
          h('div', { 'data-custom-fallback': '', onClick: reset }, (error as Error).message),
      },
    })
    await nextTick()

    const custom = w.find('[data-custom-fallback]')
    expect(custom.exists()).toBe(true)
    expect(custom.text()).toBe('kaboom')
    // No default fallback when a custom one is supplied.
    expect(w.find('[data-iris-error-boundary]').exists()).toBe(false)
  })

  it('renders the guarded subtree when nothing throws', () => {
    boom.value = false
    const w = mount(IrisErrorBoundary, { slots: { default: () => h(Boom) } })
    expect(w.find('[data-ok]').text()).toBe('recovered')
    expect(w.find('[data-iris-error-boundary]').exists()).toBe(false)
  })
})
