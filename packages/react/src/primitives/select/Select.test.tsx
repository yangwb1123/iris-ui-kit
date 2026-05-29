import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSelect } from './Select'

afterEach(() => cleanup())

const items = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', disabled: true },
  { value: 'd', label: 'Delta' },
]

function trigger(): HTMLButtonElement {
  return document.querySelector('[data-iris-select-trigger]') as HTMLButtonElement
}
function listbox(): HTMLElement | null {
  return document.querySelector('[role=listbox]')
}
function options(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=option]'))
}

describe('@iris-ui/react IrisSelect', () => {
  it('renders trigger with placeholder when no value', () => {
    render(<IrisSelect items={items} placeholder="Pick…" />)
    expect(trigger()).not.toBeNull()
    expect(trigger().textContent).toContain('Pick…')
  })

  it('shows the selected label', () => {
    render(<IrisSelect items={items} value="b" />)
    expect(trigger().textContent).toContain('Bravo')
  })

  it('renders listbox on open', () => {
    render(<IrisSelect items={items} />)
    expect(listbox()).toBeNull()
    act(() => {
      fireEvent.click(trigger())
    })
    expect(listbox()).not.toBeNull()
    expect(options().length).toBe(4)
  })

  it('clicking an option fires onValueChange and closes listbox', () => {
    const onChange = vi.fn()
    render(<IrisSelect items={items} onValueChange={onChange} />)
    act(() => {
      fireEvent.click(trigger())
    })
    const [, b] = options()
    act(() => {
      fireEvent.click(b!)
    })
    expect(onChange).toHaveBeenCalledWith('b')
    expect(listbox()).toBeNull()
  })

  it('aria-selected reflects the current value', () => {
    render(<IrisSelect items={items} value="b" />)
    act(() => {
      fireEvent.click(trigger())
    })
    const [a, b] = options()
    expect(a!.getAttribute('aria-selected')).toBe('false')
    expect(b!.getAttribute('aria-selected')).toBe('true')
  })

  it('disabled item is aria-disabled and click does nothing', () => {
    const onChange = vi.fn()
    render(<IrisSelect items={items} onValueChange={onChange} />)
    act(() => {
      fireEvent.click(trigger())
    })
    const c = options()[2]!
    expect(c.getAttribute('aria-disabled')).toBe('true')
    act(() => {
      fireEvent.click(c)
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(listbox()).not.toBeNull()
  })

  it('ArrowDown moves focus across options (skipping disabled)', () => {
    render(<IrisSelect items={items} />)
    act(() => {
      fireEvent.click(trigger())
    })
    const [a, b, , d] = options()
    a!.focus()
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(b)
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(d)
  })

  it('Home / End jump to first / last enabled options', () => {
    render(<IrisSelect items={items} />)
    act(() => {
      fireEvent.click(trigger())
    })
    const [a, , , d] = options()
    a!.focus()
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'End' })
    })
    expect(document.activeElement).toBe(d)
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'Home' })
    })
    expect(document.activeElement).toBe(a)
  })

  it('Enter on the active option selects + closes', () => {
    const onChange = vi.fn()
    render(<IrisSelect items={items} onValueChange={onChange} />)
    act(() => {
      fireEvent.click(trigger())
    })
    const a = options()[0]!
    a.focus()
    act(() => {
      fireEvent.keyDown(a, { key: 'Enter' })
    })
    expect(onChange).toHaveBeenCalledWith('a')
    expect(listbox()).toBeNull()
  })

  it('controlled value reflects on UI', () => {
    const { rerender } = render(<IrisSelect items={items} value="a" />)
    expect(trigger().textContent).toContain('Alpha')
    rerender(<IrisSelect items={items} value="d" />)
    expect(trigger().textContent).toContain('Delta')
  })

  it('uncontrolled defaultValue sets initial label', () => {
    render(<IrisSelect items={items} defaultValue="b" />)
    expect(trigger().textContent).toContain('Bravo')
  })

  it('uncontrolled selecting updates label without onValueChange', () => {
    render(<IrisSelect items={items} defaultValue="a" />)
    act(() => {
      fireEvent.click(trigger())
    })
    act(() => {
      fireEvent.click(options()[1]!)
    })
    expect(trigger().textContent).toContain('Bravo')
  })

  it('invalid sets aria-invalid on trigger', () => {
    render(<IrisSelect items={items} invalid />)
    expect(trigger().getAttribute('aria-invalid')).toBe('true')
  })

  it('id and ariaDescribedby propagate (form field integration)', () => {
    render(<IrisSelect items={items} id="my-select" ariaDescribedby="hint-id" />)
    expect(trigger().id).toBe('my-select')
    expect(trigger().getAttribute('aria-describedby')).toBe('hint-id')
  })

  it('disabled prevents opening', () => {
    render(<IrisSelect items={items} disabled />)
    expect(trigger().disabled).toBe(true)
  })

  it('size prop reflects on data attr', () => {
    render(<IrisSelect items={items} size="sm" />)
    expect(trigger().getAttribute('data-iris-select-size')).toBe('sm')
  })
})
