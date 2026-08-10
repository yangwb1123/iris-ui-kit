import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisResizable, type IrisResizableSize } from './Resizable'

// ---------------------------------------------------------------------------
// Regression tests for the per-render useDrag accumulation bug:
// `renderHandle()` used to create a fresh ref + call `useDrag` per handle per
// render. Vue never re-invokes old *function* refs with null on patch, so the
// previous render's listener set was never detached: every pointer event
// dispatched through every accumulated closure set, and from the second drag
// onward every armed set emitted duplicate update:size/resizeStart/resizeEnd.
// Fix: a module-level keyed `ResizableHandle` sub-component whose setup()
// (and therefore useDrag) runs exactly once per handle instance.
// ---------------------------------------------------------------------------

const { useDragSpy } = vi.hoisted(() => ({ useDragSpy: vi.fn() }))

// Delegating mock: the real useDrag (listener attach, watcher flush) still
// runs; the spy only counts invocations. Mock is per-file, so it cannot leak
// into Behaviors.test.ts or other suites.
vi.mock('../primitives/drag/useDrag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../primitives/drag/useDrag')>()
  return {
    ...actual,
    useDrag: ((options: Parameters<typeof actual.useDrag>[0]) => {
      useDragSpy(options)
      return actual.useDrag(options)
    }) as typeof actual.useDrag,
  }
})

const ALL_HANDLES = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

function makePointerEvent(type: string, init: PointerEventInit = {}): Event {
  // jsdom may not implement PointerEvent — fall back to a synthetic Event
  // and decorate with the fields useDrag reads (same pattern as useDrag.test.ts).
  const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
  if (typeof PointerCtor === 'function') {
    return new (PointerCtor as new (type: string, init?: EventInit) => Event)(type, {
      bubbles: true,
      ...init,
    })
  }
  const event = new Event(type, { bubbles: true })
  Object.assign(event, {
    button: init.button ?? 0,
    buttons: init.buttons ?? 1,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerId: init.pointerId ?? 1,
  })
  return event
}

/** 20-move drag on the right handle: clientX 100 -> 101..120 (dx 1..20). */
async function dragRight(wrapper: ReturnType<typeof mount>, moves = 20): Promise<void> {
  const handle = wrapper.find('[data-iris-resizable-handle=right]').element as HTMLElement
  handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
  for (let i = 1; i <= moves; i++) {
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 100 + i, clientY: 100 }))
    // Load-bearing: per-move flush. Without it all moves dispatch in one
    // synchronous burst, renders batch, and the spy/emission counts lose
    // their discriminating power (buggy code would appear to pass).
    await nextTick()
  }
  handle.dispatchEvent(makePointerEvent('pointerup', { clientX: 100 + moves, clientY: 100 }))
}

function clearBody() {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
}

afterEach(() => {
  clearBody()
  useDragSpy.mockClear()
})

describe('@iris-ui-kit/vue IrisResizable — useDrag instance stability', () => {
  it('AC1: useDrag invoked exactly once per handle, even across a 20-step drag', async () => {
    const wrapper = mount(IrisResizable, {
      props: { defaultSize: { width: 200, height: 200 } },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    // flush: 'post' watcher attaches listeners one microtask after mount
    await nextTick()
    expect(useDragSpy.mock.calls.length).toBe(ALL_HANDLES.length)

    await dragRight(wrapper, 20)
    // Each move re-renders the parent (setSize -> internal.value). The fixed
    // code keeps the keyed ResizableHandle instances alive, so useDrag must
    // NOT be re-invoked per render. Buggy baseline: 8 * 21 renders = 168.
    expect(useDragSpy.mock.calls.length).toBe(ALL_HANDLES.length)
    wrapper.unmount()
  })

  it('AC1b: handles prop round-trip does not re-invoke useDrag for kept instances', async () => {
    const wrapper = mount(IrisResizable, {
      props: { defaultSize: { width: 200, height: 200 } },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    await nextTick()
    expect(useDragSpy.mock.calls.length).toBe(8)
    useDragSpy.mockClear()

    // Keyed persistence: the 'right' instance is kept, so zero new useDrag.
    await wrapper.setProps({ handles: ['right'] })
    await nextTick()
    expect(useDragSpy.mock.calls.length).toBe(0)

    // Back to all 8: 7 instances remount, each invoking useDrag exactly once.
    await wrapper.setProps({ handles: ALL_HANDLES })
    await nextTick()
    expect(useDragSpy.mock.calls.length).toBe(7)
    wrapper.unmount()
  })

  it('AC1c: useDrag runs once per handle when handles are limited up front', async () => {
    const wrapper = mount(IrisResizable, {
      props: { defaultSize: { width: 200, height: 200 }, handles: ['right'] },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    await nextTick()
    expect(useDragSpy.mock.calls.length).toBe(1)
    wrapper.unmount()
  })
})

describe('@iris-ui-kit/vue IrisResizable — drag integration (two consecutive drags)', () => {
  it('AC3: exactly 20 monotonic update:size / 1 resizeStart / 1 resizeEnd PER drag, twice in a row', async () => {
    const wrapper = mount(IrisResizable, {
      props: { defaultSize: { width: 200, height: 200 } },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    await nextTick()

    const runDrag = async () => {
      const before = {
        update: wrapper.emitted('update:size')?.length ?? 0,
        start: wrapper.emitted('resizeStart')?.length ?? 0,
        end: wrapper.emitted('resizeEnd')?.length ?? 0,
      }
      await dragRight(wrapper, 20)
      const updates = (wrapper.emitted('update:size') ?? []).slice(before.update)
      const widths = updates.map((e) => (e[0] as IrisResizableSize).width)
      return {
        widths,
        updateDelta: (wrapper.emitted('update:size')?.length ?? 0) - before.update,
        startDelta: (wrapper.emitted('resizeStart')?.length ?? 0) - before.start,
        endDelta: (wrapper.emitted('resizeEnd')?.length ?? 0) - before.end,
        startPayload: wrapper.emitted('resizeStart')?.slice(-1)[0]?.[0] as IrisResizableSize,
        endPayload: wrapper.emitted('resizeEnd')?.slice(-1)[0]?.[0] as IrisResizableSize,
      }
    }

    // Drag 1: snapshot 200 -> widths 201..220
    const drag1 = await runDrag()
    expect(drag1.updateDelta).toBe(20)
    expect(drag1.startDelta).toBe(1)
    expect(drag1.endDelta).toBe(1)
    expect(drag1.widths).toEqual(Array.from({ length: 20 }, (_, i) => 201 + i))
    expect(drag1.startPayload).toEqual({ width: 200, height: 200 })
    expect(drag1.endPayload).toEqual({ width: 220, height: 200 })

    // Drag 2 (same handle, no remount): snapshots the CURRENT size (220) ->
    // widths 221..240. This drag is the discriminator: on the buggy code the
    // accumulated listener sets fire together (420 update:size / 21
    // resizeStart / 21 resizeEnd for 20 moves).
    const drag2 = await runDrag()
    expect(drag2.updateDelta).toBe(20)
    expect(drag2.startDelta).toBe(1)
    expect(drag2.endDelta).toBe(1)
    expect(drag2.widths).toEqual(Array.from({ length: 20 }, (_, i) => 221 + i))
    expect(drag2.startPayload).toEqual({ width: 220, height: 200 })
    expect(drag2.endPayload).toEqual({ width: 240, height: 200 })

    // Cumulative totals pin the 1:1 semantics end to end.
    expect(wrapper.emitted('update:size')?.length).toBe(40)
    expect(wrapper.emitted('resizeStart')?.length).toBe(2)
    expect(wrapper.emitted('resizeEnd')?.length).toBe(2)
    wrapper.unmount()
  })

  it('keeps height untouched for a right-handle drag and emits resizeEnd payload', async () => {
    const wrapper = mount(IrisResizable, {
      props: { defaultSize: { width: 300, height: 150 } },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    await nextTick()
    await dragRight(wrapper, 3)
    const last = wrapper.emitted('update:size')?.slice(-1)[0]?.[0] as IrisResizableSize
    expect(last).toEqual({ width: 303, height: 150 })
    expect(wrapper.emitted('resizeEnd')?.slice(-1)[0]?.[0]).toEqual({ width: 303, height: 150 })
    wrapper.unmount()
  })
})
