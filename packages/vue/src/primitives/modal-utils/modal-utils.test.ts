import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock'
import { useFocusTrap } from './useFocusTrap'

// `active` is a Ref<boolean> in the Vue API; pass a ref-backed prop.
const LockerRef = defineComponent({
  props: { active: { type: Object, required: true } },
  setup(props) {
    useBodyScrollLock(props.active as unknown as Ref<boolean>)
    return () => null
  },
})

describe('useBodyScrollLock (Vue)', () => {
  beforeEach(() => {
    __resetBodyScrollLock()
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })
  afterEach(() => __resetBodyScrollLock())

  it('locks and restores body overflow', () => {
    document.body.style.overflow = 'auto'
    const active = ref(true)
    const wrapper = mount(LockerRef, { props: { active } })
    expect(document.body.style.overflow).toBe('hidden')
    expect(__getBodyScrollLockCount()).toBe(1)
    wrapper.unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('is reference-counted across stacked locks', () => {
    const a = mount(LockerRef, { props: { active: ref(true) } })
    const b = mount(LockerRef, { props: { active: ref(true) } })
    expect(__getBodyScrollLockCount()).toBe(2)
    a.unmount()
    expect(document.body.style.overflow).toBe('hidden') // still locked by b
    b.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not clobber a host overflow change made while locked', () => {
    const wrapper = mount(LockerRef, { props: { active: ref(true) } })
    expect(document.body.style.overflow).toBe('hidden')
    // A host (e.g. a route transition) sets its own overflow while locked.
    document.body.style.overflow = 'clip'
    wrapper.unmount()
    // unlock must respect the host's value, not blindly restore the pre-lock one.
    expect(document.body.style.overflow).toBe('clip')
  })
})

const Trap = defineComponent({
  props: {
    active: { type: Object, required: true },
    returnFocusTo: { type: Object, required: false, default: undefined },
  },
  setup(props) {
    const container = ref<HTMLElement | null>(null)
    useFocusTrap({
      container,
      active: props.active as unknown as Ref<boolean>,
      returnFocusTo: props.returnFocusTo as unknown as
        | Ref<HTMLElement | null | undefined>
        | undefined,
      initialFocus: false,
    })
    return () => h('div', { ref: container }, [h('button', { type: 'button' }, 'inside')])
  },
})

/** Run the next requestAnimationFrame callback synchronously. */
async function flushRaf() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

describe('useFocusTrap restore guard (Vue)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('restores focus to a still-connected trigger', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const active = ref(true)
    const wrapper = mount(Trap, { props: { active }, attachTo: document.body })
    // Deactivate the trap, which schedules the focus restore on the next rAF.
    active.value = false
    await wrapper.vm.$nextTick()
    await flushRaf()

    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
    trigger.remove()
  })

  it('does not call focus() on a detached restore target', async () => {
    const detached = document.createElement('button')
    // never appended to the document → isConnected === false
    const focusSpy = vi.spyOn(detached, 'focus')
    const returnFocusTo = ref<HTMLElement | null | undefined>(detached)

    const active = ref(true)
    const wrapper = mount(Trap, {
      props: { active, returnFocusTo },
      attachTo: document.body,
    })
    active.value = false
    await wrapper.vm.$nextTick()
    await flushRaf()

    expect(focusSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
