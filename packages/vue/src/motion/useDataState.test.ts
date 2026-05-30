import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useDataState } from './useDataState'
import { __DATA_STATE_STYLE_ID, __resetDataStateStyles } from './styles'
import type { DataStateInput } from '@iris-ui/core'

afterEach(() => __resetDataStateStyles())

function probe(input: DataStateInput) {
  return defineComponent({
    setup() {
      const r = useDataState(() => input)
      return () =>
        h('div', {
          'data-testid': 'probe',
          'data-state': r.state.value,
          'data-content': String(r.isContent.value),
          ...r.stateProps.value,
        })
    },
  })
}

describe('@iris-ui/vue useDataState', () => {
  it('resolves "content" with no flags', () => {
    const el = mount(probe({})).get('[data-testid=probe]')
    expect(el.attributes('data-state')).toBe('content')
    expect(el.attributes('data-content')).toBe('true')
  })

  it('follows error → loading → empty precedence', () => {
    expect(
      mount(probe({ empty: true }))
        .get('[data-testid=probe]')
        .attributes('data-iris-state'),
    ).toBe('empty')
    expect(
      mount(probe({ loading: true, empty: true }))
        .get('[data-testid=probe]')
        .attributes('data-iris-state'),
    ).toBe('loading')
    expect(
      mount(probe({ error: true, loading: true, empty: true }))
        .get('[data-testid=probe]')
        .attributes('data-iris-state'),
    ).toBe('error')
  })

  it('applies the enter-animation class and injects the stylesheet', () => {
    const w = mount(probe({ loading: true }))
    expect(w.get('[data-testid=probe]').classes()).toContain('iris-data-state-enter')
    expect(document.getElementById(__DATA_STATE_STYLE_ID)).not.toBeNull()
  })

  it('drops the animation class under prefers-reduced-motion', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    }))
    const w = mount(probe({ loading: true }))
    expect(w.get('[data-testid=probe]').classes()).not.toContain('iris-data-state-enter')
    window.matchMedia = original
  })
})
