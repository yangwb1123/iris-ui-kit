import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisToastViewport } from './ToastViewport'
import { useToast } from './useToast'
import { clearToasts, getToasts, pushToast } from './store'

enableAutoUnmount(afterEach)

describe('toast store', () => {
  beforeEach(() => clearToasts())
  afterEach(() => clearToasts())

  it('pushToast adds an entry and returns its id', () => {
    const id = pushToast({ title: 'hello' })
    expect(typeof id).toBe('string')
    expect(getToasts().length).toBe(1)
    expect(getToasts()[0]?.title).toBe('hello')
  })

  it('reusing an id replaces the entry in place', () => {
    const id = pushToast({ id: 'fixed', title: 'first' })
    pushToast({ id: 'fixed', title: 'second' })
    expect(id).toBe('fixed')
    expect(getToasts().length).toBe(1)
    expect(getToasts()[0]?.title).toBe('second')
  })

  it('useToast.success sets variant=success', () => {
    const toast = useToast()
    toast.success({ title: 'ok' })
    expect(getToasts()[0]?.variant).toBe('success')
  })

  it('dismiss removes by id', () => {
    const toast = useToast()
    const id = toast.push({ title: 'gone' })
    toast.dismiss(id)
    expect(getToasts().length).toBe(0)
  })

  it('clear removes all', () => {
    pushToast({ title: 'a' })
    pushToast({ title: 'b' })
    clearToasts()
    expect(getToasts().length).toBe(0)
  })
})

describe('IrisToastViewport', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    clearToasts()
    host = document.createElement('div')
    document.body.appendChild(host)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    clearToasts()
    host.remove()
  })

  function Harness() {
    return defineComponent({
      setup: () => () => h(IrisToastViewport, { teleport: false }),
    })
  }

  it('renders a viewport container', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    await nextTick()
    expect(wrapper.find('[data-iris-toast-viewport]').exists()).toBe(true)
  })

  it('renders a pushed toast', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'Saved', duration: 0 })
    await nextTick()
    expect(wrapper.find('[data-iris-toast]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Saved')
  })

  // jsdom's PointerEvent drops clientX from its init, so build the event and
  // define clientX explicitly to drive the swipe handlers.
  function swipePointer(
    node: Element,
    kind: 'pointerdown' | 'pointermove' | 'pointerup',
    clientX: number,
  ) {
    const ev = new Event(kind, { bubbles: true, cancelable: true }) as PointerEvent
    Object.defineProperty(ev, 'pointerId', { value: 1, configurable: true })
    Object.defineProperty(ev, 'clientX', { value: clientX, configurable: true })
    node.dispatchEvent(ev)
  }

  it('swiping a toast past the threshold dismisses it', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'Swipe me', duration: Infinity })
    await nextTick()
    const toast = wrapper.find('[data-iris-toast]').element
    swipePointer(toast, 'pointerdown', 0)
    swipePointer(toast, 'pointermove', 140)
    swipePointer(toast, 'pointerup', 140)
    await nextTick()
    expect(getToasts().length).toBe(0)
    expect(wrapper.find('[data-iris-toast]').exists()).toBe(false)
  })

  it('releasing a small swipe (below threshold) keeps the toast', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'Keep me', duration: Infinity })
    await nextTick()
    const toast = wrapper.find('[data-iris-toast]').element
    swipePointer(toast, 'pointerdown', 0)
    swipePointer(toast, 'pointermove', 30)
    swipePointer(toast, 'pointerup', 30)
    await nextTick()
    expect(getToasts().length).toBe(1)
    expect(wrapper.find('[data-iris-toast]').exists()).toBe(true)
  })

  it('error variant uses role=alert + aria-live=assertive', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'Boom', variant: 'error', duration: 0 })
    await nextTick()
    const t = wrapper.find('[data-iris-toast]')
    expect(t.attributes('role')).toBe('alert')
    expect(t.attributes('aria-live')).toBe('assertive')
  })

  it('non-error toast uses role=status + aria-live=polite', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'Hi', variant: 'info', duration: 0 })
    await nextTick()
    const t = wrapper.find('[data-iris-toast]')
    expect(t.attributes('role')).toBe('status')
    expect(t.attributes('aria-live')).toBe('polite')
  })

  it('auto-dismisses after duration', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'tmp', duration: 200 })
    await nextTick()
    expect(wrapper.find('[data-iris-toast]').exists()).toBe(true)
    vi.advanceTimersByTime(250)
    await nextTick()
    expect(getToasts().length).toBe(0)
  })

  it('manual dismiss via close button', async () => {
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({ title: 'tmp', duration: 0 })
    await nextTick()
    await wrapper.find('[aria-label="Dismiss"]').trigger('click')
    await nextTick()
    expect(getToasts().length).toBe(0)
  })

  it('respects max prop (evicts oldest)', async () => {
    const wrapper = mount(
      defineComponent({
        setup: () => () => h(IrisToastViewport, { teleport: false, max: 2 }),
      }),
      { attachTo: host },
    )
    pushToast({ id: 'a', title: 'A', duration: 0 })
    pushToast({ id: 'b', title: 'B', duration: 0 })
    pushToast({ id: 'c', title: 'C', duration: 0 })
    await nextTick()
    const items = wrapper.findAll('[data-iris-toast]')
    expect(items.length).toBe(2)
    expect(items[0]!.text()).toContain('B')
    expect(items[1]!.text()).toContain('C')
  })

  it('action button fires its handler and dismisses the toast', async () => {
    let called = 0
    const wrapper = mount(Harness(), { attachTo: host })
    pushToast({
      title: 'Saved',
      duration: 0,
      action: { label: 'Undo', onClick: () => called++ },
    })
    await nextTick()
    const buttons = wrapper.findAll('button')
    const undoButton = buttons.find((b) => b.text() === 'Undo')
    expect(undoButton).toBeDefined()
    await undoButton!.trigger('click')
    await nextTick()
    expect(called).toBe(1)
    expect(getToasts().length).toBe(0)
  })

  it('viewport padding carries safe-area insets (mobile notch/home-bar clearance)', async () => {
    // Default teleport target is document.body, so query the document.
    mount(
      defineComponent({
        setup: () => () => h(IrisToastViewport, { position: 'bottom-center' }),
      }),
      { attachTo: host },
    )
    await nextTick()
    const vp = document.querySelector('[data-iris-toast-viewport]') as HTMLElement
    expect(vp.style.paddingBottom).toContain('env(safe-area-inset-bottom')
    expect(vp.style.paddingTop).toContain('env(safe-area-inset-top')
  })
})
