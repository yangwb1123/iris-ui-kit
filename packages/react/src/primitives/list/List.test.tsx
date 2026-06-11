import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisList } from './List'

afterEach(() => cleanup())

const items = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', disabled: true },
  { value: 'd', label: 'Delta' },
]

function options(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=option]'))
}

function listEl(): HTMLElement {
  return document.querySelector('[role=listbox]')!
}

describe('@iris-ui/react IrisList', () => {
  it('controlled value renders from the prop (reject → no flip; accept → flips)', () => {
    const onValueChange = vi.fn()
    function C({ value }: { value: string[] }) {
      return <IrisList items={items} multi value={value} onValueChange={onValueChange} />
    }
    const { rerender } = render(<C value={[]} />)
    act(() => {
      fireEvent.click(options()[0]!)
    })
    expect(onValueChange).toHaveBeenLastCalledWith(['a'])
    // parent has not written it back → the option stays unselected (true controlled)
    expect(options()[0]!.getAttribute('aria-selected')).toBe('false')
    rerender(<C value={['a']} />)
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true')
  })

  it('renders role="listbox" with options', () => {
    render(<IrisList items={items} />)
    expect(listEl()).not.toBeNull()
    expect(options().length).toBe(4)
  })

  it('aria-multiselectable=true when multi', () => {
    render(<IrisList items={items} multi />)
    expect(listEl().getAttribute('aria-multiselectable')).toBe('true')
  })

  it('selecting an item fires onValueChange (single)', () => {
    const onChange = vi.fn()
    render(<IrisList items={items} onValueChange={onChange} />)
    act(() => {
      fireEvent.click(options()[1]!)
    })
    expect(onChange).toHaveBeenLastCalledWith('b')
  })

  it('multi mode toggles inclusion', () => {
    const onChange = vi.fn()
    render(<IrisList items={items} multi onValueChange={onChange} />)
    act(() => {
      fireEvent.click(options()[0]!)
    })
    expect(onChange).toHaveBeenLastCalledWith(['a'])
    act(() => {
      fireEvent.click(options()[1]!)
    })
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    act(() => {
      fireEvent.click(options()[0]!)
    })
    expect(onChange).toHaveBeenLastCalledWith(['b'])
  })

  it('disabled item is aria-disabled and not selectable', () => {
    const onChange = vi.fn()
    render(<IrisList items={items} onValueChange={onChange} />)
    const c = options()[2]!
    expect(c.getAttribute('aria-disabled')).toBe('true')
    act(() => {
      fireEvent.click(c)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('aria-selected reflects value', () => {
    render(<IrisList items={items} value="b" />)
    expect(options()[1]?.getAttribute('aria-selected')).toBe('true')
    expect(options()[0]?.getAttribute('aria-selected')).toBe('false')
  })

  it('ArrowDown skips disabled items', () => {
    render(<IrisList items={items} />)
    const [a, , , d] = options()
    a!.focus()
    act(() => {
      fireEvent.keyDown(listEl(), { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(options()[1]) // b
    act(() => {
      fireEvent.keyDown(listEl(), { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(d) // skip c
  })

  it('ArrowUp wraps to last when loop=true', () => {
    render(<IrisList items={items} />)
    const a = options()[0]!
    a.focus()
    act(() => {
      fireEvent.keyDown(listEl(), { key: 'ArrowUp' })
    })
    expect(document.activeElement).toBe(options()[3])
  })

  it('loop=false stops at first/last enabled', () => {
    render(<IrisList items={items} loop={false} />)
    const a = options()[0]!
    a.focus()
    act(() => {
      fireEvent.keyDown(listEl(), { key: 'ArrowUp' })
    })
    // Stays at first since no loop.
    expect(document.activeElement).toBe(a)
  })

  it('Home / End jump to first / last enabled', () => {
    render(<IrisList items={items} />)
    const [a, , , d] = options()
    a!.focus()
    act(() => {
      fireEvent.keyDown(listEl(), { key: 'End' })
    })
    expect(document.activeElement).toBe(d)
    act(() => {
      fireEvent.keyDown(listEl(), { key: 'Home' })
    })
    expect(document.activeElement).toBe(a)
  })

  it('Enter on focused option selects', () => {
    const onChange = vi.fn()
    render(<IrisList items={items} onValueChange={onChange} />)
    options()[0]!.focus()
    act(() => {
      fireEvent.keyDown(options()[0]!, { key: 'Enter' })
    })
    expect(onChange).toHaveBeenLastCalledWith('a')
  })

  it('onSelect callback receives the IrisListItem', () => {
    const onSelect = vi.fn()
    render(<IrisList items={items} onSelect={onSelect} />)
    act(() => {
      fireEvent.click(options()[1]!)
    })
    expect(onSelect).toHaveBeenLastCalledWith(items[1])
  })

  it('controlled value reflects across rerender', () => {
    const { rerender } = render(<IrisList items={items} value="a" />)
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true')
    rerender(<IrisList items={items} value="d" />)
    expect(options()[3]?.getAttribute('aria-selected')).toBe('true')
  })

  it('renderItem customizes content', () => {
    render(
      <IrisList
        items={items}
        renderItem={(it) => <strong data-testid="bold">{it.label}</strong>}
      />,
    )
    expect(document.querySelectorAll('[data-testid=bold]').length).toBe(4)
  })
})

describe('@iris-ui/react IrisList data states', () => {
  it('shows the empty state (localized) when items is empty', () => {
    render(<IrisList items={[]} />)
    const node = document.querySelector('[data-iris-list-state]')!
    expect(node).not.toBeNull()
    expect(node.getAttribute('data-iris-list-state')).toBe('empty')
    expect(node.textContent).toBe('No items')
  })

  it('shows loading over empty, with aria-busy on the listbox', () => {
    render(<IrisList items={[]} loading />)
    expect(
      document.querySelector('[data-iris-list-state]')?.getAttribute('data-iris-list-state'),
    ).toBe('loading')
    expect(document.querySelector('[role=listbox]')?.getAttribute('aria-busy')).toBe('true')
  })

  it('error takes precedence over loading', () => {
    render(<IrisList items={[]} loading error />)
    expect(
      document.querySelector('[data-iris-list-state]')?.getAttribute('data-iris-list-state'),
    ).toBe('error')
  })

  it('renders a custom state node', () => {
    render(<IrisList items={[]} error errorState={<span data-testid="boom">Boom</span>} />)
    expect(document.querySelector('[data-testid=boom]')).not.toBeNull()
  })

  it('renders options (no state node) when content is present', () => {
    render(<IrisList items={items} />)
    expect(document.querySelector('[data-iris-list-state]')).toBeNull()
    expect(document.querySelectorAll('[role=option]').length).toBe(items.length)
  })

  it('applies the enter-animation class on the state node', () => {
    render(<IrisList items={[]} loading />)
    expect(document.querySelector('[data-iris-list-state]')?.className).toContain(
      'iris-data-state-enter',
    )
  })
})
