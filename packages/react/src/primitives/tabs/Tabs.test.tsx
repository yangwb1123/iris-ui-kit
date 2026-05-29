import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTabs } from './Tabs'
import { IrisTabsList } from './TabsList'
import { IrisTabsTrigger } from './TabsTrigger'
import { IrisTabsContent } from './TabsContent'

afterEach(() => cleanup())

function harness(props?: {
  value?: string
  defaultValue?: string
  onValueChange?: (next: string) => void
  orientation?: 'horizontal' | 'vertical'
  lazy?: boolean
  disableB?: boolean
  globalDisabled?: boolean
}) {
  return (
    <IrisTabs
      value={props?.value}
      defaultValue={props?.defaultValue}
      onValueChange={props?.onValueChange}
      orientation={props?.orientation}
      disabled={props?.globalDisabled}
      lazy={props?.lazy}
    >
      <IrisTabsList>
        <IrisTabsTrigger value="a">A</IrisTabsTrigger>
        <IrisTabsTrigger value="b" disabled={props?.disableB}>
          B
        </IrisTabsTrigger>
        <IrisTabsTrigger value="c">C</IrisTabsTrigger>
      </IrisTabsList>
      <IrisTabsContent value="a">Panel A</IrisTabsContent>
      <IrisTabsContent value="b">Panel B</IrisTabsContent>
      <IrisTabsContent value="c">Panel C</IrisTabsContent>
    </IrisTabs>
  )
}

function triggers(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=tab]'))
}

function tablist(): HTMLElement {
  return document.querySelector('[role=tablist]')!
}

describe('@iris-ui/react IrisTabs', () => {
  it('renders tablist + tabs + visible panel', () => {
    const { container } = render(harness({ defaultValue: 'a' }))
    expect(container.querySelector('[role=tablist]')).not.toBeNull()
    expect(triggers().length).toBe(3)
    // Only the active panel renders by default (lazy=true).
    expect(container.querySelectorAll('[role=tabpanel]').length).toBe(1)
    expect(container.querySelector('[role=tabpanel]')?.textContent).toBe('Panel A')
  })

  it('clicking a trigger activates its panel', () => {
    const { container } = render(harness({ defaultValue: 'a' }))
    const [, b] = triggers()
    act(() => {
      fireEvent.click(b!)
    })
    expect(container.querySelector('[role=tabpanel]')?.textContent).toBe('Panel B')
  })

  it('aria-selected reflects active tab', () => {
    render(harness({ defaultValue: 'b' }))
    const [a, b, c] = triggers()
    expect(a!.getAttribute('aria-selected')).toBe('false')
    expect(b!.getAttribute('aria-selected')).toBe('true')
    expect(c!.getAttribute('aria-selected')).toBe('false')
  })

  it('tabIndex roving (active=0, others=-1)', () => {
    render(harness({ defaultValue: 'b' }))
    const [a, b, c] = triggers()
    expect(a!.tabIndex).toBe(-1)
    expect(b!.tabIndex).toBe(0)
    expect(c!.tabIndex).toBe(-1)
  })

  it('controlled value drives state', () => {
    const { rerender, container } = render(harness({ value: 'a' }))
    expect(container.querySelector('[role=tabpanel]')?.textContent).toBe('Panel A')
    rerender(harness({ value: 'c' }))
    expect(container.querySelector('[role=tabpanel]')?.textContent).toBe('Panel C')
  })

  it('uncontrolled emits onValueChange on click', () => {
    const onChange = vi.fn()
    render(harness({ defaultValue: 'a', onValueChange: onChange }))
    const [, b] = triggers()
    act(() => {
      fireEvent.click(b!)
    })
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('ArrowRight moves focus to the next trigger and activates it', () => {
    render(harness({ defaultValue: 'a' }))
    const [a, b] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'ArrowRight' })
    })
    expect(document.activeElement).toBe(b)
    expect(b!.getAttribute('aria-selected')).toBe('true')
  })

  it('ArrowLeft wraps to last', () => {
    render(harness({ defaultValue: 'a' }))
    const [a, , c] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'ArrowLeft' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('ArrowRight skips disabled triggers', () => {
    render(harness({ defaultValue: 'a', disableB: true }))
    const [a, , c] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'ArrowRight' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('Home jumps to first enabled trigger', () => {
    render(harness({ defaultValue: 'c' }))
    const [a, , c] = triggers()
    c!.focus()
    act(() => {
      fireEvent.keyDown(c!, { key: 'Home' })
    })
    expect(document.activeElement).toBe(a)
  })

  it('End jumps to last enabled trigger', () => {
    render(harness({ defaultValue: 'a' }))
    const [a, , c] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'End' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('vertical orientation uses ArrowDown/Up + aria-orientation', () => {
    render(harness({ defaultValue: 'a', orientation: 'vertical' }))
    expect(tablist().getAttribute('aria-orientation')).toBe('vertical')
    const [a, b] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(b)
  })

  it('clicking disabled trigger does not activate', () => {
    const onChange = vi.fn()
    render(harness({ defaultValue: 'a', disableB: true, onValueChange: onChange }))
    const [, b] = triggers()
    fireEvent.click(b!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('global disabled disables all triggers', () => {
    render(harness({ defaultValue: 'a', globalDisabled: true }))
    const t = triggers()
    expect(t.every((el) => el.hasAttribute('disabled'))).toBe(true)
  })

  it('first registered enabled trigger becomes default (uncontrolled, no defaultValue)', () => {
    const { container } = render(
      <IrisTabs>
        <IrisTabsList>
          <IrisTabsTrigger value="x">X</IrisTabsTrigger>
          <IrisTabsTrigger value="y">Y</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="x">Panel X</IrisTabsContent>
        <IrisTabsContent value="y">Panel Y</IrisTabsContent>
      </IrisTabs>,
    )
    expect(container.querySelector('[role=tabpanel]')?.textContent).toBe('Panel X')
  })

  it('forceMount renders inactive panel with hidden attribute', () => {
    const { container } = render(
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a">A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">B</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">Panel A</IrisTabsContent>
        <IrisTabsContent value="b" forceMount>
          Panel B
        </IrisTabsContent>
      </IrisTabs>,
    )
    const panels = container.querySelectorAll('[role=tabpanel]')
    expect(panels.length).toBe(2)
    const inactive = Array.from(panels).find((p) => p.textContent === 'Panel B')!
    expect((inactive as HTMLElement).hidden).toBe(true)
  })

  it('lazy=false renders all panels', () => {
    const { container } = render(harness({ defaultValue: 'a', lazy: false }))
    expect(container.querySelectorAll('[role=tabpanel]').length).toBe(3)
  })

  it('Trigger outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisTabsTrigger value="x">x</IrisTabsTrigger>)).toThrow(
      /must be inside an <IrisTabs>/,
    )
    e.mockRestore()
  })

  it('asChild renders the provided element', () => {
    const { container } = render(
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a" asChild>
            <a href="#a">A</a>
          </IrisTabsTrigger>
          <IrisTabsTrigger value="b">B</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">A</IrisTabsContent>
        <IrisTabsContent value="b">B</IrisTabsContent>
      </IrisTabs>,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('role')).toBe('tab')
    expect(link.getAttribute('aria-selected')).toBe('true')
  })
})
