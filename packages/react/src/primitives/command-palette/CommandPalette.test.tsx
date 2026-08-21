import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCommandPalette } from './CommandPalette'
import { IrisI18nProvider } from '../../i18n'
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

describe('@iris-ui-kit/react defaultFilter', () => {
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

describe('@iris-ui-kit/react IrisCommandPalette', () => {
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

  it('dialog/search/list aria-labels default to English and are localizable via i18n', () => {
    const { unmount } = render(<IrisCommandPalette open items={items} />)
    expect(document.querySelector('[data-iris-command-palette]')?.getAttribute('aria-label')).toBe(
      'Command palette',
    )
    expect(input().getAttribute('aria-label')).toBe('Search commands')
    expect(
      document.querySelector('[data-iris-command-palette-list]')?.getAttribute('aria-label'),
    ).toBe('Commands')
    unmount()
    render(
      <IrisI18nProvider
        messages={{
          'commandPalette.label': 'Palette de commandes',
          'commandPalette.search': 'Rechercher des commandes',
          'commandPalette.commands': 'Commandes',
        }}
      >
        <IrisCommandPalette open items={items} />
      </IrisI18nProvider>,
    )
    expect(document.querySelector('[data-iris-command-palette]')?.getAttribute('aria-label')).toBe(
      'Palette de commandes',
    )
    expect(input().getAttribute('aria-label')).toBe('Rechercher des commandes')
    expect(
      document.querySelector('[data-iris-command-palette-list]')?.getAttribute('aria-label'),
    ).toBe('Commandes')
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

describe('@iris-ui-kit/react IrisCommandPalette virtual', () => {
  // 10k items, no groups → spacer = pure item math (36px each).
  const BIG: IrisCommandItem[] = Array.from({ length: 10_000 }, (_, i) => ({
    id: `c${i}`,
    label: `Command ${i}`,
  }))

  // jsdom reports clientHeight 0 → viewport collapses. Sanctioned stub
  // (Cascader.test.tsx pattern): 400px viewport stands in for the flex-resolved
  // 70vh surface; 400 / 36 ≈ 12 visible rows + 2×4 buffer.
  let originalClientHeight: PropertyDescriptor | undefined
  beforeEach(() => {
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 400,
    })
  })
  afterEach(() => {
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
    } else {
      delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight
    }
  })

  const scroller = () => document.querySelector('[data-iris-virtual-scroll]') as HTMLElement
  const mountedIndices = () =>
    [...scroller().querySelectorAll('[data-iris-virtual-index]')].map((el) =>
      Number(el.getAttribute('data-iris-virtual-index')),
    )

  // This is an intentional 10k-row stress case for the opt-out/plain path.
  // Keep the suite's normal 5s timeout for ordinary tests, but give this
  // browser-like DOM construction enough room on slower CI workers.
  it('A1: default off — full DOM, no virtual scroller', () => {
    const { unmount } = render(<IrisCommandPalette open items={BIG} />)
    expect(document.querySelectorAll('[data-iris-command-palette-item]').length).toBe(10_000)
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    unmount()
    // Group headers still render on the plain path.
    render(<IrisCommandPalette open items={items} />)
    expect(document.querySelectorAll('[data-iris-command-palette-group]').length).toBe(2)
  }, 15_000)

  it('A2: virtual on — windowed mount, exact spacer, single listbox', () => {
    render(<IrisCommandPalette open items={BIG} virtual />)
    const mounted = document.querySelectorAll('[data-iris-command-palette-item]').length
    expect(mounted).toBeGreaterThanOrEqual(1)
    expect(mounted).toBeLessThanOrEqual(20) // 12 visible @400px/36 + 2×4 buffer
    const spacer = document.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer.style.height).toBe('360000px') // 10_000 × 36
    expect(document.querySelectorAll('[role="listbox"]').length).toBe(1)
    expect(scroller().style.overflow).toBe('auto')
    expect(
      (document.querySelector('[data-iris-command-palette-list]') as HTMLElement).style.overflow,
    ).toBe('hidden')
  })

  it('A3: ArrowDown×25 scrolls the active row into view (clamped offset)', async () => {
    render(<IrisCommandPalette open items={BIG} virtual />)
    act(() => {
      for (let i = 0; i < 25; i += 1) fireEvent.keyDown(document, { key: 'ArrowDown' })
    })
    expect(scroller().scrollTop).toBe(900) // 25 × 36
    act(() => {
      fireEvent.scroll(scroller())
    })
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    expect(mountedIndices()[0]).toBe(21) // 25 − buffer
  })

  it('A4: wrap-around clamps to the tail', async () => {
    render(<IrisCommandPalette open items={BIG} virtual />)
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowUp' }) // wraps to 9999
    })
    expect(scroller().scrollTop).toBe(359600) // 360_000 − 400 (clamped max)
    act(() => {
      fireEvent.scroll(scroller())
    })
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    const indices = mountedIndices()
    expect(indices[indices.length - 1]).toBe(9999)
  })

  it('A5: query change resets scroll + active row', async () => {
    render(<IrisCommandPalette open items={BIG} virtual />)
    act(() => {
      scroller().scrollTop = 900
      fireEvent.scroll(scroller())
    })
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    expect(scroller().scrollTop).toBe(900)
    act(() => {
      fireEvent.change(input(), { target: { value: 'Command 9999' } })
    })
    // 'Command 9999' is a subsequence of exactly one label (four 9s only
    // occur in c9999), so the list collapses to a single row.
    const rows = document.querySelectorAll('[data-iris-command-palette-item]')
    expect(rows.length).toBe(1)
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true')
    expect(scroller().scrollTop).toBe(0)
  })

  it('A6: mixed header/item heights are exact', () => {
    // Consecutive 100-item groups → exactly 100 headers.
    const grouped = BIG.map((it, i) => ({ ...it, group: `Group ${Math.floor(i / 100)}` }))
    render(<IrisCommandPalette open items={grouped} virtual />)
    const spacer = document.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer.style.height).toBe('362800px') // 100×28 + 10_000×36
    expect(document.querySelector('[data-iris-command-palette-group]')).not.toBeNull()
  })

  it('A7: disabled rows are skipped by virtual nav and preserved', () => {
    const withDisabled = BIG.map((it, i) => (i === 1 ? { ...it, disabled: true } : it))
    render(<IrisCommandPalette open items={withDisabled} virtual />)
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowDown' })
    })
    const selected = [...document.querySelectorAll('[data-iris-command-palette-item]')].find(
      (el) => el.getAttribute('aria-selected') === 'true',
    )
    expect(selected?.getAttribute('data-iris-command-palette-item')).toBe('c2')
    const disabled = document.querySelector('[data-iris-command-palette-item="c1"]')
    expect(disabled?.getAttribute('aria-disabled')).toBe('true')
  })

  it('A8: empty state renders outside virtualization', () => {
    render(<IrisCommandPalette open items={BIG} virtual />)
    act(() => {
      fireEvent.change(input(), { target: { value: 'zzz-no-match' } })
    })
    expect(document.querySelector('[data-iris-command-palette-empty]')).not.toBeNull()
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })
})
