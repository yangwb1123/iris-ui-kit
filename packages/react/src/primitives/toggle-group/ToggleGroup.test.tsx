import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisToggleGroup } from './ToggleGroup'
import { IrisToggleGroupItem } from './ToggleGroupItem'

afterEach(() => cleanup())

function single(props?: {
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (v: string | null) => void
  disabled?: boolean
}) {
  return (
    <IrisToggleGroup
      type="single"
      value={props?.value as string | null | undefined}
      defaultValue={props?.defaultValue as string | null | undefined}
      onValueChange={props?.onValueChange}
      disabled={props?.disabled}
    >
      <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
      <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
      <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
    </IrisToggleGroup>
  )
}

function multi(props?: {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (v: string[]) => void
}) {
  return (
    <IrisToggleGroup
      type="multiple"
      value={props?.value}
      defaultValue={props?.defaultValue}
      onValueChange={props?.onValueChange}
    >
      <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
      <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
    </IrisToggleGroup>
  )
}

function items(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll('[data-iris-toggle-group-item]'),
  ) as HTMLButtonElement[]
}

describe('@iris-ui-kit/react IrisToggleGroup (single)', () => {
  it('controlled value renders from the prop (reject → no flip; accept → flips)', () => {
    const onValueChange = vi.fn()
    function C({ value }: { value: string | null }) {
      return single({ value, onValueChange })
    }
    const { rerender } = render(<C value={null} />)
    act(() => {
      fireEvent.click(items()[0]!)
    })
    expect(onValueChange).toHaveBeenLastCalledWith('a')
    // parent rejected → item A stays off (true controlled)
    expect(items()[0]!.getAttribute('data-state')).toBe('off')
    rerender(<C value="a" />)
    expect(items()[0]!.getAttribute('data-state')).toBe('on')
  })

  it('renders radiogroup role with radio items', () => {
    render(single())
    expect(document.querySelector('[role=radiogroup]')).not.toBeNull()
    expect(items().every((it) => it.getAttribute('role') === 'radio')).toBe(true)
  })

  it('selecting an item sets aria-checked and emits onValueChange', () => {
    const onChange = vi.fn()
    render(single({ onValueChange: onChange }))
    const [a] = items()
    act(() => {
      fireEvent.click(a!)
    })
    expect(onChange).toHaveBeenCalledWith('a')
    expect(a!.getAttribute('aria-checked')).toBe('true')
  })

  it('selecting the active item unselects it (toggle off)', () => {
    const onChange = vi.fn()
    render(single({ defaultValue: 'a', onValueChange: onChange }))
    const [a] = items()
    act(() => {
      fireEvent.click(a!)
    })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('ArrowRight moves focus to next', () => {
    render(single({ defaultValue: 'a' }))
    const [a, b] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'ArrowRight' })
    })
    expect(document.activeElement).toBe(b)
  })

  it('ArrowLeft wraps to last', () => {
    render(single({ defaultValue: 'a' }))
    const [a, , c] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'ArrowLeft' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('Home and End jump to first/last', () => {
    render(single())
    const [a, b, c] = items()
    b!.focus()
    act(() => {
      fireEvent.keyDown(b!, { key: 'Home' })
    })
    expect(document.activeElement).toBe(a)
    act(() => {
      fireEvent.keyDown(a!, { key: 'End' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('Space activates focused item', () => {
    const onChange = vi.fn()
    render(single({ onValueChange: onChange }))
    const [a] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: ' ' })
    })
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('disabled group blocks toggling', () => {
    const onChange = vi.fn()
    render(single({ disabled: true, onValueChange: onChange }))
    fireEvent.click(items()[0]!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('controlled value reflects on items', () => {
    const { rerender } = render(single({ value: null }))
    expect(items().every((it) => it.getAttribute('aria-checked') === 'false')).toBe(true)
    rerender(single({ value: 'b' }))
    expect(items()[1]!.getAttribute('aria-checked')).toBe('true')
  })

  it('roving tabindex: active=0, others=-1', () => {
    render(single({ defaultValue: 'b' }))
    const [a, b, c] = items()
    expect(a!.tabIndex).toBe(-1)
    expect(b!.tabIndex).toBe(0)
    expect(c!.tabIndex).toBe(-1)
  })
})

describe('@iris-ui-kit/react IrisToggleGroup (multiple)', () => {
  it('renders group role with aria-pressed items', () => {
    render(multi())
    expect(document.querySelector('[role=group]')).not.toBeNull()
    expect(items().every((it) => it.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('toggling adds and removes from array', () => {
    const onChange = vi.fn()
    render(multi({ onValueChange: onChange }))
    const [a, b] = items()
    act(() => {
      fireEvent.click(a!)
    })
    expect(onChange).toHaveBeenLastCalledWith(['a'])
    act(() => {
      fireEvent.click(b!)
    })
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
  })

  it('toggling an active item removes it', () => {
    const onChange = vi.fn()
    render(multi({ defaultValue: ['a'], onValueChange: onChange }))
    const [a] = items()
    act(() => {
      fireEvent.click(a!)
    })
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('Item outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisToggleGroupItem value="x">x</IrisToggleGroupItem>)).toThrow(
      /must be inside an <IrisToggleGroup>/,
    )
    e.mockRestore()
  })
})
