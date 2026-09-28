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
    const onSelect = vi.fn()
    const [value, setValue] = createSignal<string[]>([])
    const { container } = render(() => (
      <IrisList items={fruits} multi value={value()} onChange={onChange} onSelect={onSelect} />
    ))
    const options = (): Element[] => Array.from(container.querySelectorAll('[role="option"]'))
    fireEvent.click(options()[0] as HTMLElement) // click "Apple"
    expect(onChange).toHaveBeenLastCalledWith(['apple'])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(fruits[0])
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

  it('calls onSelect with the complete item when an item is clicked', () => {
    const onSelect = vi.fn()
    const { getByText } = render(() => <IrisList items={fruits} onSelect={onSelect} />)
    fireEvent.click(getByText('Apple'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(fruits[0])
  })

  it.each(['Enter', ' '])('calls onSelect once for keyboard selection with %s', (key) => {
    const onSelect = vi.fn()
    const { container } = render(() => <IrisList items={fruits} onSelect={onSelect} />)
    const option = container.querySelector('[role="option"]') as HTMLElement
    fireEvent.keyDown(option, { key })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(fruits[0])
  })

  it('calls onChange once when an item is clicked', () => {
    const onChange = vi.fn()
    const { getByText } = render(() => <IrisList items={fruits} onChange={onChange} />)
    fireEvent.click(getByText('Apple'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('apple')
  })

  it('does not call onSelect for disabled items', () => {
    const onSelect = vi.fn()
    const { getByText } = render(() => <IrisList items={fruits} onSelect={onSelect} />)
    fireEvent.click(getByText('Cherry'))
    expect(onSelect).not.toHaveBeenCalled()
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

  it('renders the empty state when items is empty', () => {
    const { container } = render(() => <IrisList items={[]} />)
    expect(container.querySelector('[data-iris-list-state="empty"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0)
  })

  it('renders the loading state with aria-busy', () => {
    const { container } = render(() => <IrisList items={[]} loading />)
    expect(container.querySelector('[data-iris-list-state="loading"]')).not.toBeNull()
    expect(container.querySelector('ul')!.getAttribute('aria-busy')).toBe('true')
  })

  it('keeps existing items mounted during a loading revalidate', () => {
    const [loading, setLoading] = createSignal(false)
    const { container } = render(() => <IrisList items={fruits} loading={loading()} />)
    setLoading(true)
    expect(container.querySelector('[data-iris-list-state]')).toBeNull()
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(fruits.length)
    expect(container.querySelector('[role="option"]')?.textContent).toContain('Apple')
    expect(container.querySelector('ul')!.getAttribute('aria-busy')).toBe('true')
  })

  it('error state takes precedence over loading', () => {
    const { container } = render(() => <IrisList items={[]} loading error />)
    expect(container.querySelector('[data-iris-list-state="error"]')).not.toBeNull()
  })
})
