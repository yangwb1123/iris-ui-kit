import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useColorScheme } from './useColorScheme'

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
})

type Handler = (event: { matches: boolean }) => void

function mockMatchMedia(initialDark: boolean) {
  const listeners = new Set<Handler>()
  const mql = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_t: string, cb: Handler) => listeners.add(cb),
    removeEventListener: (_t: string, cb: Handler) => listeners.delete(cb),
    addListener: (cb: Handler) => listeners.add(cb),
    removeListener: (cb: Handler) => listeners.delete(cb),
  }
  ;(window as unknown as { matchMedia: unknown }).matchMedia = vi.fn(() => mql)
  return {
    set(dark: boolean) {
      mql.matches = dark
      listeners.forEach((cb) => cb({ matches: dark }))
    },
    listenerCount: () => listeners.size,
  }
}

const Probe = defineComponent({
  setup() {
    const scheme = useColorScheme()
    return () => h('span', { class: 'scheme' }, scheme.value)
  },
})

describe('@iris-ui/vue useColorScheme', () => {
  it('reports the initial system scheme', () => {
    mockMatchMedia(true)
    const wrapper = mount(Probe)
    expect(wrapper.find('.scheme').text()).toBe('dark')
  })

  it('updates when the system preference flips', async () => {
    const m = mockMatchMedia(false)
    const wrapper = mount(Probe)
    expect(wrapper.find('.scheme').text()).toBe('light')
    m.set(true)
    await nextTick()
    expect(wrapper.find('.scheme').text()).toBe('dark')
  })

  it('unsubscribes on unmount', () => {
    const m = mockMatchMedia(false)
    const wrapper = mount(Probe)
    expect(m.listenerCount()).toBe(1)
    wrapper.unmount()
    expect(m.listenerCount()).toBe(0)
  })

  it('falls back to "light" without matchMedia', () => {
    const wrapper = mount(Probe)
    expect(wrapper.find('.scheme').text()).toBe('light')
  })
})
