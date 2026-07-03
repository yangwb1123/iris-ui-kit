import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisResizable } from './Resizable'
import { IrisMovable } from './Movable'
import { IrisHotkey } from './Hotkey'
import { IrisClickOutside } from './ClickOutside'
import { IrisSortable } from './Sortable'
import { IrisLongPress } from './LongPress'

afterEach(() => cleanup())

describe('@iris-ui/react IrisResizable', () => {
  it('wraps child in a relative inline-block container with width/height', () => {
    const { container } = render(
      <IrisResizable defaultSize={{ width: 300, height: 200 }}>
        <div data-testid="child">x</div>
      </IrisResizable>,
    )
    const root = container.querySelector('[data-iris-resizable]') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.style.position).toBe('relative')
    expect(root.style.display).toBe('inline-block')
    expect(root.style.width).toBe('300px')
    expect(root.style.height).toBe('200px')
    expect(container.querySelector('[data-testid=child]')).not.toBeNull()
  })

  it('renders all 8 handles by default', () => {
    const { container } = render(
      <IrisResizable defaultSize={{ width: 100, height: 100 }}>
        <span>x</span>
      </IrisResizable>,
    )
    expect(container.querySelectorAll('[data-iris-resizable-handle]').length).toBe(8)
  })

  it('handles prop limits which handles render', () => {
    const { container } = render(
      <IrisResizable defaultSize={{ width: 100, height: 100 }} handles={['bottom-right']}>
        <span>x</span>
      </IrisResizable>,
    )
    const h = container.querySelectorAll('[data-iris-resizable-handle]')
    expect(h.length).toBe(1)
    expect(h[0]?.getAttribute('data-iris-resizable-handle')).toBe('bottom-right')
  })

  it('controlled size drives the wrapper width/height', () => {
    const { container, rerender } = render(
      <IrisResizable size={{ width: 100, height: 100 }}>
        <span>x</span>
      </IrisResizable>,
    )
    let root = container.querySelector('[data-iris-resizable]') as HTMLElement
    expect(root.style.width).toBe('100px')
    rerender(
      <IrisResizable size={{ width: 250, height: 175 }}>
        <span>x</span>
      </IrisResizable>,
    )
    root = container.querySelector('[data-iris-resizable]') as HTMLElement
    expect(root.style.width).toBe('250px')
    expect(root.style.height).toBe('175px')
  })

  it('child is rendered without modification (no extra props)', () => {
    const { container } = render(
      <IrisResizable defaultSize={{ width: 100, height: 100 }}>
        <div data-testid="child" data-foo="bar">
          x
        </div>
      </IrisResizable>,
    )
    const child = container.querySelector('[data-testid=child]')!
    expect(child.getAttribute('data-foo')).toBe('bar')
  })

  it('disabled state reflects on data-state', () => {
    const { container } = render(
      <IrisResizable defaultSize={{ width: 100, height: 100 }} disabled>
        <span>x</span>
      </IrisResizable>,
    )
    expect(container.querySelector('[data-iris-resizable]')?.getAttribute('data-state')).toBe(
      'disabled',
    )
  })
})

describe('@iris-ui/react IrisMovable', () => {
  it('wraps child in an absolutely-positioned container at defaultPosition', () => {
    const { container } = render(
      <IrisMovable defaultPosition={{ x: 42, y: -7 }}>
        <div>x</div>
      </IrisMovable>,
    )
    const root = container.querySelector('[data-iris-movable]') as HTMLElement
    expect(root.style.position).toBe('absolute')
    expect(root.style.transform).toContain('translate3d(42px, -7px, 0)')
  })

  it('controlled position drives the transform', () => {
    const { container, rerender } = render(<IrisMovable position={{ x: 0, y: 0 }}>x</IrisMovable>)
    expect(
      (container.querySelector('[data-iris-movable]') as HTMLElement).style.transform,
    ).toContain('translate3d(0px, 0px')
    rerender(<IrisMovable position={{ x: 50, y: 30 }}>x</IrisMovable>)
    expect(
      (container.querySelector('[data-iris-movable]') as HTMLElement).style.transform,
    ).toContain('translate3d(50px, 30px')
  })

  it('default state is "idle"', () => {
    const { container } = render(<IrisMovable>x</IrisMovable>)
    expect(container.querySelector('[data-iris-movable]')?.getAttribute('data-state')).toBe('idle')
  })

  it('byHandle changes cursor on root to default', () => {
    const { container } = render(
      <IrisMovable byHandle>
        <span data-iris-movable-handle>handle</span>
      </IrisMovable>,
    )
    expect((container.querySelector('[data-iris-movable]') as HTMLElement).style.cursor).toBe(
      'default',
    )
  })

  it('disabled cursor is not-allowed', () => {
    const { container } = render(<IrisMovable disabled>x</IrisMovable>)
    expect((container.querySelector('[data-iris-movable]') as HTMLElement).style.cursor).toBe(
      'not-allowed',
    )
  })
})

describe('@iris-ui/react IrisHotkey', () => {
  it('renders children as-is (no extra DOM)', () => {
    const { container } = render(
      <IrisHotkey shortcut="Escape" onTrigger={() => {}}>
        <div data-testid="child">x</div>
      </IrisHotkey>,
    )
    // No wrapping element added by Hotkey itself.
    expect(container.firstChild).toBe(container.querySelector('[data-testid=child]'))
  })

  it('fires onTrigger when the shortcut is pressed', () => {
    const onTrigger = vi.fn()
    render(
      <IrisHotkey shortcut="Escape" onTrigger={onTrigger}>
        <div>x</div>
      </IrisHotkey>,
    )
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onTrigger).toHaveBeenCalledOnce()
  })

  it('Mod+s matches Cmd+S OR Ctrl+S', () => {
    const onTrigger = vi.fn()
    render(
      <IrisHotkey shortcut="Mod+s" onTrigger={onTrigger}>
        <div>x</div>
      </IrisHotkey>,
    )
    act(() => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    })
    expect(onTrigger).toHaveBeenCalledOnce()
    act(() => {
      fireEvent.keyDown(document, { key: 's', metaKey: true })
    })
    expect(onTrigger).toHaveBeenCalledTimes(2)
  })

  it('Shift modifier required', () => {
    const onTrigger = vi.fn()
    render(
      <IrisHotkey shortcut="Shift+/" onTrigger={onTrigger}>
        <div>x</div>
      </IrisHotkey>,
    )
    act(() => {
      fireEvent.keyDown(document, { key: '/' })
    })
    expect(onTrigger).not.toHaveBeenCalled()
    act(() => {
      fireEvent.keyDown(document, { key: '/', shiftKey: true })
    })
    expect(onTrigger).toHaveBeenCalledOnce()
  })

  it('disabled skips the listener', () => {
    const onTrigger = vi.fn()
    render(
      <IrisHotkey shortcut="Escape" onTrigger={onTrigger} disabled>
        <div>x</div>
      </IrisHotkey>,
    )
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('ignored when focus is in an input by default', () => {
    const onTrigger = vi.fn()
    const { container } = render(
      <div>
        <IrisHotkey shortcut="Enter" onTrigger={onTrigger}>
          <div>x</div>
        </IrisHotkey>
        <input id="hk-test-input" />
      </div>,
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    input.focus()
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('allowInInputs lets the hotkey fire from inputs', () => {
    const onTrigger = vi.fn()
    const { container } = render(
      <div>
        <IrisHotkey shortcut="Enter" onTrigger={onTrigger} allowInInputs>
          <div>x</div>
        </IrisHotkey>
        <input id="hk-test-input-2" />
      </div>,
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    input.focus()
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onTrigger).toHaveBeenCalledOnce()
  })

  it('list of shortcuts: any match fires', () => {
    const onTrigger = vi.fn()
    render(
      <IrisHotkey shortcut={['Escape', 'Mod+s']} onTrigger={onTrigger}>
        <div>x</div>
      </IrisHotkey>,
    )
    act(() => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    })
    expect(onTrigger).toHaveBeenCalledOnce()
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onTrigger).toHaveBeenCalledTimes(2)
  })
})

describe('@iris-ui/react IrisClickOutside', () => {
  it('fires onOutside when pointerdown is outside the wrapped tree', () => {
    const onOutside = vi.fn()
    const { container } = render(
      <div>
        <div data-testid="outside">outside</div>
        <IrisClickOutside onOutside={onOutside}>
          <div data-testid="inside">inside</div>
        </IrisClickOutside>
      </div>,
    )
    act(() => {
      fireEvent.pointerDown(container.querySelector('[data-testid=outside]')!)
    })
    expect(onOutside).toHaveBeenCalledOnce()
  })

  it('does not fire when pointerdown is inside the wrapped tree', () => {
    const onOutside = vi.fn()
    render(
      <IrisClickOutside onOutside={onOutside}>
        <div data-testid="inside">x</div>
      </IrisClickOutside>,
    )
    act(() => {
      fireEvent.pointerDown(document.querySelector('[data-testid=inside]')!)
    })
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('ignore list treats listed refs as inside', () => {
    const onOutside = vi.fn()
    function H() {
      const ref = React.useRef<HTMLDivElement>(null)
      return (
        <div>
          <div ref={ref} data-testid="trigger">
            trigger
          </div>
          <IrisClickOutside onOutside={onOutside} ignore={[ref]}>
            <div data-testid="inside">x</div>
          </IrisClickOutside>
        </div>
      )
    }
    const { container } = render(<H />)
    act(() => {
      fireEvent.pointerDown(container.querySelector('[data-testid=trigger]')!)
    })
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('disabled skips the listener', () => {
    const onOutside = vi.fn()
    const { container } = render(
      <div>
        <div data-testid="outside">x</div>
        <IrisClickOutside onOutside={onOutside} disabled>
          <div>inside</div>
        </IrisClickOutside>
      </div>,
    )
    act(() => {
      fireEvent.pointerDown(container.querySelector('[data-testid=outside]')!)
    })
    expect(onOutside).not.toHaveBeenCalled()
  })
})

describe('@iris-ui/react behaviors composition (stacking)', () => {
  it('Resizable + Movable + Hotkey + ClickOutside stack around a single child', () => {
    const onOutside = vi.fn()
    const onEscape = vi.fn()
    const { container } = render(
      <IrisResizable defaultSize={{ width: 300, height: 200 }}>
        <IrisMovable defaultPosition={{ x: 10, y: 20 }}>
          <IrisHotkey shortcut="Escape" onTrigger={onEscape}>
            <IrisClickOutside onOutside={onOutside}>
              <div data-testid="payload">payload</div>
            </IrisClickOutside>
          </IrisHotkey>
        </IrisMovable>
      </IrisResizable>,
    )
    // All four wrappers present.
    expect(container.querySelector('[data-iris-resizable]')).not.toBeNull()
    expect(container.querySelector('[data-iris-movable]')).not.toBeNull()
    expect(container.querySelector('[data-iris-click-outside]')).not.toBeNull()
    expect(container.querySelector('[data-testid=payload]')).not.toBeNull()

    // Escape triggers from Hotkey.
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onEscape).toHaveBeenCalledOnce()
  })
})

describe('@iris-ui/react IrisSortable', () => {
  it('renders items with data-iris-sortable-item attributes', () => {
    const { container } = render(
      <IrisSortable items={['A', 'B', 'C']} onReorder={() => {}}>
        <div key="A">A</div>
        <div key="B">B</div>
        <div key="C">C</div>
      </IrisSortable>,
    )
    const items = container.querySelectorAll('[data-iris-sortable-item]')
    expect(items.length).toBe(3)
    expect(items[0]?.getAttribute('data-iris-sortable-item')).toBe('0')
    expect(items[1]?.getAttribute('data-iris-sortable-item')).toBe('1')
    expect(items[2]?.getAttribute('data-iris-sortable-item')).toBe('2')
  })

  it('marks root data-iris-sortable and idle state', () => {
    const { container } = render(
      <IrisSortable items={['A']} onReorder={() => {}}>
        <div key="A">A</div>
      </IrisSortable>,
    )
    const root = container.querySelector('[data-iris-sortable]') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-state')).toBe('idle')
  })

  it('disabled state reflects on opacity', () => {
    const { container } = render(
      <IrisSortable items={['A']} onReorder={() => {}} disabled>
        <div key="A">A</div>
      </IrisSortable>,
    )
    const root = container.querySelector('[data-iris-sortable]') as HTMLElement
    expect(root.style.opacity).toBe('0.6')
  })
})

describe('@iris-ui/react IrisLongPress', () => {
  it('renders children inside a display:contents span', () => {
    const { container } = render(
      <IrisLongPress onLongPress={() => {}}>
        <div data-testid="child">x</div>
      </IrisLongPress>,
    )
    const wrapper = container.querySelector('[data-iris-long-press]')
    expect(wrapper).not.toBeNull()
    expect(container.querySelector('[data-testid=child]')).not.toBeNull()
  })

  it('fires onLongPress after holdDelay', async () => {
    const onLongPress = vi.fn()
    render(
      <IrisLongPress holdDelay={10} onLongPress={onLongPress}>
        <div>x</div>
      </IrisLongPress>,
    )
    const wrapper = document.querySelector('[data-iris-long-press]')!
    fireEvent.pointerDown(wrapper)
    await new Promise((r) => setTimeout(r, 50))
    expect(onLongPress).toHaveBeenCalledOnce()
  })

  it('does not fire on quick release before holdDelay', async () => {
    const onLongPress = vi.fn()
    render(
      <IrisLongPress holdDelay={50} onLongPress={onLongPress}>
        <div>x</div>
      </IrisLongPress>,
    )
    const wrapper = document.querySelector('[data-iris-long-press]')!
    fireEvent.pointerDown(wrapper)
    await new Promise((r) => setTimeout(r, 10))
    fireEvent.pointerUp(wrapper)
    await new Promise((r) => setTimeout(r, 60))
    expect(onLongPress).not.toHaveBeenCalled()
  })
})
