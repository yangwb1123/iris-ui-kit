import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

const Probe = defineComponent({
  setup() {
    const reduced = usePrefersReducedMotion()
    return () => h('div', { 'data-testid': 'p', 'data-reduced': String(reduced.value) })
  },
})

function mockMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }))
}

describe('@iris-ui-kit/vue usePrefersReducedMotion', () => {
  it('is false when matchMedia is unavailable', () => {
    const original = window.matchMedia
    // @ts-expect-error simulate environments without matchMedia
    delete window.matchMedia
    const w = mount(Probe)
    expect(w.get('[data-testid=p]').attributes('data-reduced')).toBe('false')
    window.matchMedia = original
  })

  it('is true when the user prefers reduced motion', () => {
    const original = window.matchMedia
    window.matchMedia = mockMatchMedia(true)
    const w = mount(Probe)
    expect(w.get('[data-testid=p]').attributes('data-reduced')).toBe('true')
    window.matchMedia = original
  })
})
