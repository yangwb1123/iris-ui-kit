import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useFloating } from './useFloating'

const { computePositionMock } = vi.hoisted(() => ({ computePositionMock: vi.fn() }))
vi.mock('@floating-ui/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>()
  return {
    ...actual,
    computePosition: (...args: unknown[]) => computePositionMock(...args),
    // No-op autoUpdate so update() only runs when we call it (deterministic).
    autoUpdate: () => () => {},
  }
})
const pos = (x: number, y: number) => ({
  x,
  y,
  placement: 'bottom' as const,
  strategy: 'absolute' as const,
  middlewareData: {},
})

const TestHarness = defineComponent({
  setup() {
    const anchor = ref<HTMLElement | null>(null)
    const floating = ref<HTMLElement | null>(null)
    const open = ref(false)
    const { floatingStyles, finalPlacement, x, y, update } = useFloating({
      anchor,
      floating,
      open,
      placement: 'bottom',
      offset: 8,
    })
    return { anchor, floating, open, floatingStyles, finalPlacement, x, y, update }
  },
  render() {
    return h('div', [
      h('div', { ref: 'anchor', class: 'anchor', style: { width: '40px', height: '20px' } }),
      h(
        'div',
        {
          ref: 'floating',
          class: 'floating',
          style: this.floatingStyles,
        },
        'content',
      ),
    ])
  },
})

describe('useFloating', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    computePositionMock.mockReset()
    computePositionMock.mockResolvedValue(pos(0, 0))
  })

  afterEach(() => {
    host.remove()
  })

  it('returns floatingStyles ready to bind to the floating element', async () => {
    const wrapper = mount(TestHarness, { attachTo: host })
    await nextTick()
    const styles = wrapper.vm.floatingStyles
    expect(styles.position).toBe('absolute')
    expect(styles.top).toBe('0')
    expect(styles.left).toBe('0')
    expect(styles.transform).toMatch(/translate3d/)
    expect(styles.width).toBe('max-content')
  })

  it('does not throw when refs are null', async () => {
    const NullCase = defineComponent({
      setup() {
        const anchor = ref<HTMLElement | null>(null)
        const floating = ref<HTMLElement | null>(null)
        const open = ref(true)
        useFloating({ anchor, floating, open })
        return {}
      },
      render() {
        return h('div')
      },
    })
    expect(() => mount(NullCase)).not.toThrow()
  })

  it('computes position when open becomes true', async () => {
    const wrapper = mount(TestHarness, { attachTo: host })
    await nextTick()
    wrapper.vm.open = true
    await nextTick()
    await wrapper.vm.update()
    // jsdom returns zero rects, so positions stay zero — but no error means wiring works.
    expect(typeof wrapper.vm.x).toBe('number')
    expect(typeof wrapper.vm.y).toBe('number')
  })

  it('finalPlacement defaults to the input placement', () => {
    const wrapper = mount(TestHarness, { attachTo: host })
    expect(wrapper.vm.finalPlacement).toBe('bottom')
  })

  it('drops a computePosition result that resolves after the scope is disposed', async () => {
    let resolve!: (v: ReturnType<typeof pos>) => void
    computePositionMock.mockReturnValueOnce(
      new Promise<ReturnType<typeof pos>>((r) => (resolve = r)),
    )
    const wrapper = mount(TestHarness, { attachTo: host })
    wrapper.vm.open = true
    await nextTick()
    const pending = wrapper.vm.update()
    wrapper.unmount() // onScopeDispose bumps the epoch
    resolve(pos(999, 999))
    await pending
    // Stale result must not have been applied (component already gone).
    expect(wrapper.vm.x).toBe(0)
    expect(wrapper.vm.y).toBe(0)
  })

  it('applies only the latest of two overlapping updates', async () => {
    const wrapper = mount(TestHarness, { attachTo: host })
    wrapper.vm.open = true
    await nextTick()
    computePositionMock.mockReset()
    computePositionMock.mockResolvedValueOnce(pos(10, 10)).mockResolvedValueOnce(pos(20, 20))
    const a = wrapper.vm.update()
    const b = wrapper.vm.update()
    await Promise.all([a, b])
    // The second update started last, so its epoch token wins.
    expect(wrapper.vm.x).toBe(20)
    expect(wrapper.vm.y).toBe(20)
  })
})
