import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
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
    const el = document.createElement('div')
    const app = createApp({
      render: () => h(IrisErrorBoundary, null, { default: () => h(Boom) }),
    })
    app.mount(el)
    await nextTick()

    const alert = el.querySelector('[data-iris-error-boundary]')
    expect(alert).not.toBeNull()
    expect(alert?.getAttribute('role')).toBe('alert')
    expect(el.querySelector('[data-iris-error-boundary-message]')?.textContent).toBe('kaboom')
    expect(el.querySelector('[data-iris-error-boundary-retry]')).not.toBeNull()
    app.unmount()
  })

  it('calls onError with the caught error', async () => {
    const onError = vi.fn()
    const el = document.createElement('div')
    const app = createApp({
      render: () => h(IrisErrorBoundary, { onError }, { default: () => h(Boom) }),
    })
    app.mount(el)
    await nextTick()

    expect(onError).toHaveBeenCalledTimes(1)
    const [err] = onError.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('kaboom')
    app.unmount()
  })

  it('reset() lets a now-fixed child render again', async () => {
    const el = document.createElement('div')
    const app = createApp({
      render: () => h(IrisErrorBoundary, null, { default: () => h(Boom) }),
    })
    app.mount(el)
    await nextTick()
    expect(el.querySelector('[data-iris-error-boundary]')).not.toBeNull()

    // Fix the child, then trigger reset() via the retry button.
    boom.value = false
    el.querySelector<HTMLButtonElement>('[data-iris-error-boundary-retry]')?.click()
    await nextTick()

    expect(el.querySelector('[data-iris-error-boundary]')).toBeNull()
    expect(el.querySelector('[data-ok]')?.textContent).toBe('recovered')
    app.unmount()
  })

  it('passes { error, reset } to a custom #fallback slot', async () => {
    const el = document.createElement('div')
    const app = createApp({
      render: () =>
        h(IrisErrorBoundary, null, {
          default: () => h(Boom),
          fallback: ({ error, reset }: { error: unknown; reset: () => void }) =>
            h('div', { 'data-custom-fallback': '', onClick: reset }, (error as Error).message),
        }),
    })
    app.mount(el)
    await nextTick()

    const custom = el.querySelector('[data-custom-fallback]')
    expect(custom).not.toBeNull()
    expect(custom?.textContent).toBe('kaboom')
    // No default fallback when a custom one is supplied.
    expect(el.querySelector('[data-iris-error-boundary]')).toBeNull()
    app.unmount()
  })

  it('renders the guarded subtree when nothing throws', () => {
    boom.value = false
    const w = mount(IrisErrorBoundary, { slots: { default: () => h(Boom) } })
    expect(w.find('[data-ok]').text()).toBe('recovered')
    expect(w.find('[data-iris-error-boundary]').exists()).toBe(false)
  })

  // Global-handler tests use createApp, NOT @vue/test-utils mount(): mount()
  // installs an unconditional errorHandler wrapper (vue-test-utils.cjs.js:8276)
  // that rethrows mount-time errors after app.mount() — with the boundary now
  // forwarding contained errors to app.config.errorHandler, any mount()-based
  // test whose child throws would throw out of mount() before asserting. The
  // throwing-path tests below (existing + new) therefore use the createApp +
  // manual app.mount pattern; assertions are unchanged.
  it('forwards contained errors to app.config.errorHandler exactly once, fallback still renders', async () => {
    const errorHandler = vi.fn()
    const el = document.createElement('div')
    const app = createApp({
      render: () => h(IrisErrorBoundary, null, { default: () => h(Boom) }),
    })
    app.config.errorHandler = errorHandler
    app.mount(el)
    await nextTick()

    // Containment untouched: fallback still renders with the thrown message.
    expect(el.querySelector('[data-iris-error-boundary]')).not.toBeNull()
    expect(el.querySelector('[data-iris-error-boundary-message]')?.textContent).toBe('kaboom')

    // Global handler invoked exactly once, with Vue's own (err, instance, info).
    expect(errorHandler).toHaveBeenCalledTimes(1)
    const [err, , info] = errorHandler.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('kaboom')
    expect(info).toBe('render function')

    app.unmount()
  })

  it('calls the onError prop alongside the global errorHandler', async () => {
    const propSpy = vi.fn()
    const errorHandler = vi.fn()
    const el = document.createElement('div')
    const app = createApp({
      render: () => h(IrisErrorBoundary, { onError: propSpy }, { default: () => h(Boom) }),
    })
    app.config.errorHandler = errorHandler
    app.mount(el)
    await nextTick()

    expect(propSpy).toHaveBeenCalledTimes(1)
    expect(propSpy.mock.calls[0][0]).toBeInstanceOf(Error)
    expect((propSpy.mock.calls[0][0] as Error).message).toBe('kaboom')
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect((errorHandler.mock.calls[0][0] as Error).message).toBe('kaboom')

    app.unmount()
  })

  it('reports a contained error exactly once even with nested boundaries', async () => {
    const outerSpy = vi.fn()
    const innerSpy = vi.fn()
    const errorHandler = vi.fn()
    const el = document.createElement('div')
    const app = createApp({
      render: () =>
        h(
          IrisErrorBoundary,
          { onError: outerSpy },
          {
            default: () => h(IrisErrorBoundary, { onError: innerSpy }, { default: () => h(Boom) }),
          },
        ),
    })
    app.config.errorHandler = errorHandler
    app.mount(el)
    await nextTick()

    // Only the inner boundary's fallback exists; the outer never sees the error.
    expect(el.querySelectorAll('[data-iris-error-boundary]').length).toBe(1)
    expect(outerSpy).not.toHaveBeenCalled()
    expect(innerSpy).toHaveBeenCalledTimes(1)
    // Single forward from the catching boundary — no double-reporting.
    expect(errorHandler).toHaveBeenCalledTimes(1)

    app.unmount()
  })

  it('keeps containment when the global errorHandler itself throws', async () => {
    const handlerError = new Error('sentry-down')
    const errorHandler = vi.fn(() => {
      throw handlerError
    })
    const el = document.createElement('div')
    const app = createApp({
      render: () => h(IrisErrorBoundary, null, { default: () => h(Boom) }),
    })
    app.config.errorHandler = errorHandler
    app.mount(el)
    await nextTick()

    // Handler invoked exactly once with the original contained error — the
    // handler's own error is logged, never rethrown (containment intact).
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error)
    expect((errorHandler.mock.calls[0][0] as Error).message).toBe('kaboom')
    expect(consoleSpy).toHaveBeenCalledWith(handlerError)
    expect(el.querySelector('[data-iris-error-boundary]')).not.toBeNull()

    app.unmount()
  })
})
