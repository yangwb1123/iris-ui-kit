import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisLongPress } from './LongPress'

function clearBody() {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
}

afterEach(() => clearBody())

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('@iris-ui-kit/vue IrisLongPress pointercancel + reactive props', () => {
  it('AC1: pointercancel before holdDelay does NOT fire onLongPress', async () => {
    const onLongPress = vi.fn()
    const wrap = mount(IrisLongPress, {
      props: { holdDelay: 50, onLongPress },
      slots: { default: '<div>x</div>' },
    })
    wrap.element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wait(15)
    wrap.element.dispatchEvent(new Event('pointercancel', { bubbles: true }))
    await wait(70) // well past the old 50ms deadline
    expect(onLongPress).not.toHaveBeenCalled()
    // Leak guard: no stale timer fires after unmount either.
    wrap.unmount()
    await wait(50)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('AC2: disabled=true mid-hold cancels the pending gesture', async () => {
    const onLongPress = vi.fn()
    const wrap = mount(IrisLongPress, {
      props: { holdDelay: 50, disabled: false, onLongPress },
      slots: { default: '<div>x</div>' },
    })
    wrap.element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrap.setProps({ disabled: true }) // watcher has run when this resolves
    await wait(70) // well past the 50ms deadline
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('AC3: holdDelay prop update re-arms the timer with the new value', async () => {
    const onLongPress = vi.fn()
    const wrap = mount(IrisLongPress, {
      props: { holdDelay: 200, onLongPress },
      slots: { default: '<div>x</div>' },
    })
    wrap.element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrap.setProps({ holdDelay: 10 })
    await wait(5) // new 10ms delay not yet elapsed
    expect(onLongPress).not.toHaveBeenCalled()
    await wait(35) // 40ms total after the change — long before the old 200ms deadline
    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('AC4: pointerdown → pointercancel → pointerdown fires only after the second hold', async () => {
    const onLongPress = vi.fn()
    const wrap = mount(IrisLongPress, {
      props: { holdDelay: 30, onLongPress },
      slots: { default: '<div>x</div>' },
    })
    wrap.element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wait(10)
    wrap.element.dispatchEvent(new Event('pointercancel', { bubbles: true }))
    await wait(45) // past the first press's 30ms deadline: must NOT have fired
    expect(onLongPress).not.toHaveBeenCalled()
    wrap.element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wait(50)
    expect(onLongPress).toHaveBeenCalledOnce()
  })
})
