import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCommandPalette } from './CommandPalette'
import { defaultFilter, type IrisCommandItem } from './types'
import { __resetBodyScrollLock } from '../../modal-utils/useBodyScrollLock'

beforeEach(() => __resetBodyScrollLock())
afterEach(() => {
  cleanup()
  __resetBodyScrollLock()
})

const items: IrisCommandItem[] = [
  { id: 'open', label: 'Open File', group: 'File', shortcut: '⌘O' },
  { id: 'save', label: 'Save File', group: 'File', shortcut: '⌘S' },
  { id: 'close', label: 'Close Tab', group: 'Tab' },
  { id: 'pref', label: 'Preferences', group: 'Tab', disabled: true },
]

function input(): HTMLInputElement {
  return document.querySelector('[data-iris-command-palette-input]') as HTMLInputElement
}

describe('@iris-ui/react defaultFilter', () => {
  it('empty query matches everything with score 0', () => {
    expect(defaultFilter('', items[0]!)).toBe(0)
  })

  it('exact substring matches', () => {
    expect(defaultFilter('save', items[1]!)).not.toBeNull()
  })

  it('fuzzy subsequence matches', () => {
    expect(defaultFilter('sf', items[1]!)).not.toBeNull()
  })

  it('non-matching characters return null', () => {
    expect(defaultFilter('xyz', items[0]!)).toBeNull()
  })

  it('lower score = better match', () => {
    const scoreA = defaultFilter('s', items[1]!)
    const scoreB = defaultFilter('s', items[2]!)
    expect(scoreA).not.toBeNull()
    expect(scoreB).not.toBeNull()
    expect(scoreA!).toBeLessThan(scoreB!)
  })

  it('keywords contribute to the haystack', () => {
    const item: IrisCommandItem = { id: 'x', label: 'Foo', keywords: ['bar'] }
    expect(defaultFilter('bar', item)).not.toBeNull()
  })
})

describe('@iris-ui/react IrisCommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<IrisCommandPalette open={false} items={items} />)
    expect(document.querySelector('[data-iris-command-palette]')).toBeNull()
  })

  it('renders surface + input + list when open', () => {
    render(<IrisCommandPalette open items={items} />)
    expect(document.querySelector('[data-iris-command-palette]')).not.toBeNull()
    expect(document.querySelector('[data-iris-command-palette-input]')).not.toBeNull()
    expect(document.querySelector('[data-iris-command-palette-list]')).not.toBeNull()
  })

  it('lists all items by default; groups have headers', () => {
    render(<IrisCommandPalette open items={items} />)
    expect(document.querySelectorAll('[data-iris-command-palette-item]').length).toBe(4)
    expect(document.querySelectorAll('[data-iris-command-palette-group]').length).toBe(2)
  })

  it('typing filters the list', () => {
    render(<IrisCommandPalette open items={items} />)
    act(() => {
      fireEvent.change(input(), { target: { value: 'save' } })
    })
    const matches = document.querySelectorAll('[data-iris-command-palette-item]')
    expect(matches.length).toBe(1)
    expect(matches[0]?.textContent).toContain('Save')
  })

  it('shows emptyText when no matches', () => {
    render(<IrisCommandPalette open items={items} emptyText="Nothing here" />)
    act(() => {
      fireEvent.change(input(), { target: { value: 'zzzzzzzzzz' } })
    })
    expect(document.querySelector('[data-iris-command-palette-empty]')?.textContent).toBe(
      'Nothing here',
    )
  })

  it('Enter triggers the active item action + onSelect + closes', () => {
    const action = vi.fn()
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <IrisCommandPalette
        open
        items={[{ ...items[0]!, action }]}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />,
    )
    act(() => {
      fireEvent.keyDown(document, { key: 'Enter' })
    })
    expect(action).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'open' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ArrowDown moves the active item', () => {
    render(<IrisCommandPalette open items={items} />)
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowDown' })
    })
    const rows = document.querySelectorAll('[data-iris-command-palette-item]')
    expect(rows[1]?.getAttribute('aria-selected')).toBe('true')
  })

  it('Escape closes the palette', () => {
    const onOpenChange = vi.fn()
    render(<IrisCommandPalette open items={items} onOpenChange={onOpenChange} />)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disabled item is aria-disabled', () => {
    render(<IrisCommandPalette open items={items} />)
    const disabled = document.querySelector('[data-iris-command-palette-item=pref]')
    expect(disabled?.getAttribute('aria-disabled')).toBe('true')
  })

  it('clicking the backdrop closes', () => {
    const onOpenChange = vi.fn()
    render(<IrisCommandPalette open items={items} onOpenChange={onOpenChange} />)
    const backdrop = document.querySelector('[data-iris-command-palette-backdrop]')!
    act(() => {
      fireEvent.pointerDown(backdrop)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('body scroll lock engages while open', () => {
    render(<IrisCommandPalette open items={items} />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('reopening resets the query', () => {
    const { rerender } = render(<IrisCommandPalette open items={items} />)
    act(() => {
      fireEvent.change(input(), { target: { value: 'save' } })
    })
    expect(input().value).toBe('save')
    rerender(<IrisCommandPalette open={false} items={items} />)
    rerender(<IrisCommandPalette open items={items} />)
    expect(input().value).toBe('')
  })

  it('shortcut hint renders when provided', () => {
    render(<IrisCommandPalette open items={items} />)
    const shortcuts = document.querySelectorAll('[data-iris-command-palette-shortcut]')
    expect(shortcuts.length).toBe(2)
    expect(shortcuts[0]?.textContent).toBe('⌘O')
  })
})
