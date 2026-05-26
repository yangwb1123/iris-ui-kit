import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTooltip } from './Tooltip'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

function harness(props?: Partial<React.ComponentProps<typeof IrisTooltip>>) {
  return (
    <IrisTooltip content="Save changes" openDelay={0} closeDelay={0} {...props}>
      <button type="button">Save</button>
    </IrisTooltip>
  )
}

function tooltip(): HTMLElement | null {
  return document.querySelector('[role=tooltip]')
}

describe('@iris-ui/react IrisTooltip', () => {
  it('renders only the trigger initially (no tooltip until hover)', () => {
    const { container } = render(harness())
    expect(container.querySelector('button')).not.toBeNull()
    expect(tooltip()).toBeNull()
  })

  it('opens on pointerenter and closes on pointerleave (no delay)', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(tooltip()).not.toBeNull()
    act(() => {
      fireEvent.pointerLeave(btn)
    })
    expect(tooltip()).toBeNull()
  })

  it('opens on focus and closes on blur', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.focus(btn)
    })
    expect(tooltip()).not.toBeNull()
    act(() => {
      fireEvent.blur(btn)
    })
    expect(tooltip()).toBeNull()
  })

  it('respects openDelay before opening', () => {
    const { container } = render(harness({ openDelay: 300 }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(tooltip()).toBeNull()
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(tooltip()).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(tooltip()).not.toBeNull()
  })

  it('respects closeDelay before closing', () => {
    const { container } = render(harness({ closeDelay: 200 }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    act(() => {
      fireEvent.pointerLeave(btn)
    })
    expect(tooltip()).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(tooltip()).toBeNull()
  })

  it('Escape closes immediately, bypassing closeDelay', () => {
    const { container } = render(harness({ closeDelay: 5000 }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(tooltip()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(tooltip()).toBeNull()
  })

  it('tooltip has role="tooltip" with stable id linked via aria-describedby', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    const t = tooltip()!
    expect(t.id).toBeTruthy()
    expect(btn.getAttribute('aria-describedby')).toBe(t.id)
  })

  it('aria-describedby is removed when closed', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-describedby')).toBeNull()
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(btn.getAttribute('aria-describedby')).not.toBeNull()
    act(() => {
      fireEvent.pointerLeave(btn)
    })
    expect(btn.getAttribute('aria-describedby')).toBeNull()
  })

  it('disabled blocks opening', () => {
    const { container } = render(harness({ disabled: true }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(tooltip()).toBeNull()
  })

  it('disabling while open closes immediately', () => {
    const { container, rerender } = render(harness())
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(tooltip()).not.toBeNull()
    rerender(harness({ disabled: true }))
    expect(tooltip()).toBeNull()
  })

  it('renders into the configured portal target', () => {
    const target = document.createElement('div')
    target.id = 'custom-portal'
    document.body.appendChild(target)
    const { container } = render(harness({ portalTarget: target }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(target.querySelector('[role=tooltip]')).not.toBeNull()
    document.body.removeChild(target)
  })

  it('portalTarget={false} keeps tooltip in place (no portal)', () => {
    const { container } = render(harness({ portalTarget: false }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(container.querySelector('[role=tooltip]')).not.toBeNull()
  })

  it('preserves the child trigger\'s own click handler', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisTooltip content="Hi" openDelay={0}>
        <button type="button" onClick={onClick}>
          Save
        </button>
      </IrisTooltip>,
    )
    fireEvent.click(container.querySelector('button')!)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('placement is reflected on the floating element', () => {
    const { container } = render(harness({ placement: 'right' }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.pointerEnter(btn)
    })
    expect(tooltip()?.getAttribute('data-placement')).toBe('right')
  })

  it('returns null when given a non-element child', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      <IrisTooltip content="x" openDelay={0}>
        {'not a valid element'}
      </IrisTooltip>,
    )
    expect(container.firstChild).toBeNull()
    warn.mockRestore()
  })
})
