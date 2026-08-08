import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSelect } from './Select'
import { IrisFormField } from '../form-field/FormField'

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

describe('@iris-ui-kit/react IrisSelect', () => {
  it('renders trigger with placeholder when no value', () => {
    render(<IrisSelect items={items} placeholder="Pick…" />)
    expect(trigger()).not.toBeNull()
    expect(trigger().textContent).toContain('Pick…')
  })

  it('shows the selected label', () => {
    render(<IrisSelect items={items} value="b" />)
    expect(trigger().textContent).toContain('Bravo')
  })

  it('trigger announces a listbox popup (not the popover default dialog)', () => {
    render(<IrisSelect items={items} />)
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox')
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

describe('@iris-ui-kit/react IrisSelect closed-trigger keyboard', () => {
  it('ArrowDown on the closed trigger opens and focuses the selected option', () => {
    render(<IrisSelect items={items} value="d" />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(options()[3]!) // Delta
  })

  it('ArrowDown with no value focuses the first enabled option', () => {
    render(<IrisSelect items={items} />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(options()[0]!) // Alpha
  })

  it('ArrowDown with a disabled selection falls back to the first enabled option', () => {
    render(<IrisSelect items={items} value="c" />) // Charlie disabled
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(options()[0]!)
  })

  it('all-disabled: opens and focus stays on the trigger', () => {
    render(<IrisSelect items={items.map((it) => ({ ...it, disabled: true }))} />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('typeahead on the closed trigger opens, highlights the match, does not commit', () => {
    const onChange = vi.fn()
    render(<IrisSelect items={items} value="d" onValueChange={onChange} />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'b' })
    })
    expect(listbox()).not.toBeNull()
    // Bravo (index 1), NOT the selected Delta — the open-reset must not clobber.
    expect(document.activeElement).toBe(options()[1]!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('typeahead cycles through same-initial items (shared buffer with the listbox)', () => {
    render(
      <IrisSelect
        items={[
          { value: 'ap', label: 'Apple' },
          { value: 'av', label: 'Avocado' },
          { value: 'ba', label: 'Banana' },
          { value: 'ch', label: 'Cherry' },
        ]}
      />,
    )
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'a' })
    })
    expect(document.activeElement).toBe(options()[1]!) // Avocado
    act(() => {
      fireEvent.keyDown(listbox()!, { key: 'a' }) // same buffer continues
    })
    expect(document.activeElement).toBe(options()[0]!) // wraps to Apple
  })

  it('typeahead with only disabled matches opens without highlight change', () => {
    render(<IrisSelect items={items} value="d" />) // Charlie disabled
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'c' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(options()[3]!) // selected Delta
  })

  it('typeahead no match still opens and focus stays on the selected option', () => {
    render(<IrisSelect items={items} value="d" />)
    trigger().focus()
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'z' })
    })
    expect(listbox()).not.toBeNull()
    expect(document.activeElement).toBe(options()[3]!)
  })

  it('renderTrigger state carries id/ariaDescribedby/invalid/disabled (additive)', () => {
    let seen: unknown
    render(
      <IrisSelect
        items={items}
        id="my-select"
        ariaDescribedby="hint-id"
        invalid
        disabled
        renderTrigger={(s) => {
          seen = s
          return (
            <button
              type="button"
              id={s.id}
              aria-invalid={s.invalid ? 'true' : undefined}
              aria-describedby={s.ariaDescribedby}
              disabled={s.disabled || undefined}
            />
          )
        }}
      />,
    )
    const el = document.getElementById('my-select') as HTMLButtonElement
    expect(el.getAttribute('aria-invalid')).toBe('true')
    expect(el.getAttribute('aria-describedby')).toBe('hint-id')
    expect(el.disabled).toBe(true)
    expect(seen).toMatchObject({
      value: undefined,
      open: false,
      id: 'my-select',
      ariaDescribedby: 'hint-id',
      invalid: true,
      disabled: true,
      label: expect.any(String),
    })
  })

  it('FormField-generated id/ariaDescribedby/invalid reach the custom trigger', () => {
    render(
      <IrisFormField label="Choose" hint="A hint" error="Bad">
        <IrisSelect
          items={items}
          renderTrigger={(s) => (
            <button
              type="button"
              id={s.id}
              aria-invalid={s.invalid ? 'true' : undefined}
              aria-describedby={s.ariaDescribedby}
            />
          )}
        />
      </IrisFormField>,
    )
    const custom = document.querySelector('[data-iris-form-field]')!.querySelector('button')!
    expect(custom.id).toContain('-control')
    expect(custom.getAttribute('aria-invalid')).toBe('true')
    const describedBy = custom.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).not.toBeNull()
  })

  it('existing renderTrigger destructuring callers still work (additive type)', () => {
    render(
      <IrisSelect
        items={items}
        placeholder="Pick…"
        renderTrigger={({ value, label, open }) => (
          <button
            type="button"
            data-old-trigger=""
            data-value={String(value ?? '')}
            data-open={open ? '1' : '0'}
          >
            {label}
          </button>
        )}
      />,
    )
    expect(document.querySelector('[data-old-trigger]')!.textContent).toContain('Pick…')
  })

  it('disabled select ignores closed-trigger keys', () => {
    render(<IrisSelect items={items} disabled />)
    act(() => {
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    })
    expect(listbox()).toBeNull()
  })

  it('consumer onKeyDown on the custom trigger composes with the built-in handler', () => {
    const consumer = vi.fn()
    render(
      <IrisSelect
        items={items}
        renderTrigger={() => (
          <button type="button" data-custom-trigger="" onKeyDown={consumer}>
            Open
          </button>
        )}
      />,
    )
    const custom = document.querySelector('[data-custom-trigger]') as HTMLButtonElement
    // Unclaimed key: the built-in handler returns noop without preventDefault,
    // so the composed chain continues to the consumer handler.
    act(() => {
      fireEvent.keyDown(custom, { key: 'Tab' })
    })
    expect(consumer).toHaveBeenCalledTimes(1)
    expect(listbox()).toBeNull()
    // Claimed key: built-in handler preventDefaults (open) and the composed
    // chain stops — the documented IrisSlot veto semantics (slot first, child
    // can be vetoed via preventDefault).
    act(() => {
      fireEvent.keyDown(custom, { key: 'ArrowDown' })
    })
    expect(consumer).toHaveBeenCalledTimes(1)
    expect(listbox()).not.toBeNull()
  })
})
