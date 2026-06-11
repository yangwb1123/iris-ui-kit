import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisList } from './IrisList'

afterEach(cleanup)

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
]

describe('IrisList', () => {
  it('controlled value renders from the prop (reject → no flip; accept → flips)', () => {
    const onChange = vi.fn()
    const [value, setValue] = createSignal<string[]>([])
    const { container } = render(() => (
      <IrisList items={fruits} multi value={value()} onChange={onChange} />
    ))
    const options = (): Element[] => Array.from(container.querySelectorAll('[role="option"]'))
    fireEvent.click(options()[0] as HTMLElement) // click "Apple"
    expect(onChange).toHaveBeenLastCalledWith(['apple'])
    // parent has not written it back → the option stays unselected (true controlled)
    expect(options()[0]!.getAttribute('aria-selected')).toBe('false')
    // parent accepts → prop updates → the option reflects it
    setValue(['apple'])
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true')
  })

  it('renders all items', () => {
    const { getByText } = render(() => <IrisList items={fruits} />)
    expect(getByText('Apple')).toBeTruthy()
    expect(getByText('Banana')).toBeTruthy()
    expect(getByText('Cherry')).toBeTruthy()
  })

  it('has role=listbox', () => {
    const { container } = render(() => <IrisList items={fruits} />)
    expect(container.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('marks disabled items', () => {
    const { container } = render(() => <IrisList items={fruits} />)
    const items = container.querySelectorAll('[role="option"]')
    expect(items[2].getAttribute('aria-disabled')).toBe('true')
  })

  it('calls onChange when an item is clicked', () => {
    const onChange = vi.fn()
    const { getByText } = render(() => <IrisList items={fruits} onChange={onChange} />)
    fireEvent.click(getByText('Apple'))
    expect(onChange).toHaveBeenCalledWith('apple')
  })

  it('does not call onChange for disabled items', () => {
    const onChange = vi.fn()
    const { getByText } = render(() => <IrisList items={fruits} onChange={onChange} />)
    fireEvent.click(getByText('Cherry'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks selected item in controlled mode', () => {
    const { container } = render(() => <IrisList items={fruits} value="banana" />)
    const items = container.querySelectorAll('[role="option"]')
    expect(items[1].getAttribute('aria-selected')).toBe('true')
  })
})
