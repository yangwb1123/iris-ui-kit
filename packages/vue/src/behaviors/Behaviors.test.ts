import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisResizable } from './Resizable'
import { IrisMovable } from './Movable'
import { IrisHotkey } from './Hotkey'
import { IrisClickOutside } from './ClickOutside'

function clearBody() {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
}

afterEach(() => clearBody())

describe('@iris-ui/vue IrisResizable', () => {
  it('wraps child in a relative inline-block container with size', () => {
    const wrap = mount(IrisResizable, {
      props: { defaultSize: { width: 300, height: 200 } },
      slots: { default: '<div data-testid="child">x</div>' },
    })
    const root = wrap.find('[data-iris-resizable]').element as HTMLElement
    expect(root.style.position).toBe('relative')
    expect(root.style.display).toBe('inline-block')
    expect(root.style.width).toBe('300px')
    expect(root.style.height).toBe('200px')
    expect(wrap.find('[data-testid=child]').exists()).toBe(true)
  })

  it('renders all 8 handles by default', () => {
    const wrap = mount(IrisResizable, {
      props: { defaultSize: { width: 100, height: 100 } },
      slots: { default: '<span>x</span>' },
    })
    expect(wrap.findAll('[data-iris-resizable-handle]').length).toBe(8)
  })

  it('handles prop limits which handles render', () => {
    const wrap = mount(IrisResizable, {
      props: {
        defaultSize: { width: 100, height: 100 },
        handles: ['bottom-right'],
      },
      slots: { default: '<span>x</span>' },
    })
    const h = wrap.findAll('[data-iris-resizable-handle]')
    expect(h.length).toBe(1)
    expect(h[0]?.attributes('data-iris-resizable-handle')).toBe('bottom-right')
  })

  it('controlled size drives wrapper width/height', async () => {
    const wrap = mount(IrisResizable, {
      props: { size: { width: 100, height: 100 } },
      slots: { default: '<span>x</span>' },
    })
    let root = wrap.find('[data-iris-resizable]').element as HTMLElement
    expect(root.style.width).toBe('100px')
    await wrap.setProps({ size: { width: 250, height: 175 } })
    root = wrap.find('[data-iris-resizable]').element as HTMLElement
    expect(root.style.width).toBe('250px')
    expect(root.style.height).toBe('175px')
  })

  it('disabled state reflects on data-state', () => {
    const wrap = mount(IrisResizable, {
      props: { defaultSize: { width: 100, height: 100 }, disabled: true },
      slots: { default: '<span>x</span>' },
    })
    expect(wrap.find('[data-iris-resizable]').attributes('data-state')).toBe('disabled')
  })

  it('side handles have correct cursor', () => {
    const wrap = mount(IrisResizable, {
      props: {
        defaultSize: { width: 100, height: 100 },
        handles: ['top', 'right'],
      },
      slots: { default: '<span>x</span>' },
    })
    const top = wrap.find('[data-iris-resizable-handle=top]').element as HTMLElement
    const right = wrap.find('[data-iris-resizable-handle=right]').element as HTMLElement
    expect(top.style.cursor).toBe('ns-resize')
    expect(right.style.cursor).toBe('ew-resize')
  })
})

describe('@iris-ui/vue IrisMovable', () => {
  it('wraps child in absolutely-positioned container at defaultPosition', () => {
    const wrap = mount(IrisMovable, {
      props: { defaultPosition: { x: 42, y: -7 } },
      slots: { default: '<div>x</div>' },
    })
    const root = wrap.find('[data-iris-movable]').element as HTMLElement
    expect(root.style.position).toBe('absolute')
    expect(root.style.transform).toContain('translate3d(42px, -7px, 0)')
  })

  it('controlled position drives the transform', async () => {
    const wrap = mount(IrisMovable, {
      props: { position: { x: 0, y: 0 } },
      slots: { default: '<span>x</span>' },
    })
    expect(
      (wrap.find('[data-iris-movable]').element as HTMLElement).style.transform,
    ).toContain('translate3d(0px, 0px')
    await wrap.setProps({ position: { x: 50, y: 30 } })
    expect(
      (wrap.find('[data-iris-movable]').element as HTMLElement).style.transform,
    ).toContain('translate3d(50px, 30px')
  })

  it('default state is "idle"', () => {
    const wrap = mount(IrisMovable, { slots: { default: '<div>x</div>' } })
    expect(wrap.find('[data-iris-movable]').attributes('data-state')).toBe('idle')
  })

  it('byHandle changes cursor on root to default', () => {
    const wrap = mount(IrisMovable, {
      props: { byHandle: true },
      slots: {
        default: '<span data-iris-movable-handle>handle</span>',
      },
    })
    expect(
      (wrap.find('[data-iris-movable]').element as HTMLElement).style.cursor,
    ).toBe('default')
  })

  it('disabled cursor is not-allowed', () => {
    const wrap = mount(IrisMovable, {
      props: { disabled: true },
      slots: { default: '<span>x</span>' },
    })
    expect(
      (wrap.find('[data-iris-movable]').element as HTMLElement).style.cursor,
    ).toBe('not-allowed')
  })
})

describe('@iris-ui/vue IrisHotkey', () => {
  it('renders children as-is (no wrapper element)', () => {
    const wrap = mount(IrisHotkey, {
      props: { shortcut: 'Escape', onTrigger: () => {} },
      slots: { default: '<div data-testid="child">x</div>' },
    })
    // The child is rendered directly, no wrapping div.
    expect(wrap.find('[data-testid=child]').exists()).toBe(true)
  })

  it('fires onTrigger when the shortcut is pressed', async () => {
    const wrap = mount(IrisHotkey, {
      props: { shortcut: 'Escape' },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrap.emitted('trigger')?.length).toBe(1)
    wrap.unmount()
  })

  it('Mod+s matches Cmd+S OR Ctrl+S', async () => {
    const wrap = mount(IrisHotkey, {
      props: { shortcut: 'Mod+s' },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }))
    await nextTick()
    expect(wrap.emitted('trigger')?.length).toBe(2)
    wrap.unmount()
  })

  it('Shift modifier required', async () => {
    const wrap = mount(IrisHotkey, {
      props: { shortcut: 'Shift+/' },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    await nextTick()
    expect(wrap.emitted('trigger')).toBeUndefined()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', shiftKey: true }))
    await nextTick()
    expect(wrap.emitted('trigger')?.length).toBe(1)
    wrap.unmount()
  })

  it('disabled skips the listener', async () => {
    const wrap = mount(IrisHotkey, {
      props: { shortcut: 'Escape', disabled: true },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrap.emitted('trigger')).toBeUndefined()
    wrap.unmount()
  })

  it('list of shortcuts: any match fires', async () => {
    const wrap = mount(IrisHotkey, {
      props: { shortcut: ['Escape', 'Mod+s'] },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrap.emitted('trigger')?.length).toBe(2)
    wrap.unmount()
  })
})

describe('@iris-ui/vue IrisClickOutside', () => {
  it('fires outside when pointerdown is outside the wrapped tree', async () => {
    const outside = document.createElement('div')
    outside.setAttribute('data-testid', 'outside')
    document.body.appendChild(outside)
    const wrap = mount(IrisClickOutside, {
      slots: { default: '<div data-testid="inside">inside</div>' },
      attachTo: document.body,
    })
    const evt = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: outside, configurable: true })
    document.dispatchEvent(evt)
    await nextTick()
    expect(wrap.emitted('outside')?.length).toBe(1)
    wrap.unmount()
    document.body.removeChild(outside)
  })

  it('does not fire when pointerdown is inside', async () => {
    const wrap = mount(IrisClickOutside, {
      slots: { default: '<div data-testid="inside">x</div>' },
      attachTo: document.body,
    })
    const inside = document.querySelector('[data-testid=inside]')!
    const evt = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: inside, configurable: true })
    document.dispatchEvent(evt)
    await nextTick()
    expect(wrap.emitted('outside')).toBeUndefined()
    wrap.unmount()
  })

  it('disabled skips the listener', async () => {
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const wrap = mount(IrisClickOutside, {
      props: { disabled: true },
      slots: { default: '<div>x</div>' },
      attachTo: document.body,
    })
    const evt = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: outside, configurable: true })
    document.dispatchEvent(evt)
    await nextTick()
    expect(wrap.emitted('outside')).toBeUndefined()
    wrap.unmount()
    document.body.removeChild(outside)
  })
})
