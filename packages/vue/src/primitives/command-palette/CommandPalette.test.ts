import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { IrisCommandPalette } from './CommandPalette'
import { IrisI18nProvider } from '../../i18n'
import { defaultFilter, type IrisCommandItem } from './types'
import { __resetBodyScrollLock } from '../modal-utils'

function clearBody() {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
}

beforeEach(() => __resetBodyScrollLock())
afterEach(() => {
  __resetBodyScrollLock()
  clearBody()
})

const items: IrisCommandItem[] = [
  { id: 'open', label: 'Open File', group: 'File', shortcut: '⌘O' },
  { id: 'save', label: 'Save File', group: 'File', shortcut: '⌘S' },
  { id: 'close', label: 'Close Tab', group: 'Tab' },
  { id: 'pref', label: 'Preferences', group: 'Tab', disabled: true },
]

describe('@iris-ui/vue defaultFilter', () => {
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

describe('@iris-ui/vue IrisCommandPalette', () => {
  it('renders nothing when closed', () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: false, items },
      attachTo: document.body,
    })
    expect(document.querySelector('[data-iris-command-palette]')).toBeNull()
    wrap.unmount()
  })

  it('renders surface + input + list when open', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.querySelector('[data-iris-command-palette]')).not.toBeNull()
    expect(document.querySelector('[data-iris-command-palette-input]')).not.toBeNull()
    expect(document.querySelector('[data-iris-command-palette-list]')).not.toBeNull()
    wrap.unmount()
  })

  it('dialog/search/list aria-labels default to English and localize via IrisI18nProvider', async () => {
    const plain = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.querySelector('[data-iris-command-palette]')?.getAttribute('aria-label')).toBe(
      'Command palette',
    )
    expect(
      document.querySelector('[data-iris-command-palette-input]')?.getAttribute('aria-label'),
    ).toBe('Search commands')
    expect(
      document.querySelector('[data-iris-command-palette-list]')?.getAttribute('aria-label'),
    ).toBe('Commands')
    plain.unmount()
    clearBody()

    const wrap = mount(
      defineComponent({
        setup: () => () =>
          h(
            IrisI18nProvider,
            {
              messages: {
                'commandPalette.label': 'Palette de commandes',
                'commandPalette.search': 'Rechercher des commandes',
                'commandPalette.commands': 'Commandes',
              },
            },
            { default: () => h(IrisCommandPalette, { open: true, items }) },
          ),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    expect(document.querySelector('[data-iris-command-palette]')?.getAttribute('aria-label')).toBe(
      'Palette de commandes',
    )
    expect(
      document.querySelector('[data-iris-command-palette-input]')?.getAttribute('aria-label'),
    ).toBe('Rechercher des commandes')
    expect(
      document.querySelector('[data-iris-command-palette-list]')?.getAttribute('aria-label'),
    ).toBe('Commandes')
    wrap.unmount()
  })

  it('lists all items by default; groups have headers', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.querySelectorAll('[data-iris-command-palette-item]').length).toBe(4)
    expect(document.querySelectorAll('[data-iris-command-palette-group]').length).toBe(2)
    wrap.unmount()
  })

  it('typing filters the list', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const input = document.querySelector('[data-iris-command-palette-input]') as HTMLInputElement
    input.value = 'save'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const matches = document.querySelectorAll('[data-iris-command-palette-item]')
    expect(matches.length).toBe(1)
    expect(matches[0]?.textContent).toContain('Save')
    wrap.unmount()
  })

  it('shows emptyText when no matches', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items, emptyText: 'Nothing here' },
      attachTo: document.body,
    })
    await nextTick()
    const input = document.querySelector('[data-iris-command-palette-input]') as HTMLInputElement
    input.value = 'xxxxxxxxxxxxxxxxx'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(document.querySelector('[data-iris-command-palette-empty]')?.textContent).toBe(
      'Nothing here',
    )
    wrap.unmount()
  })

  it('Enter triggers active item action + emits select + closes', async () => {
    const action = vi.fn()
    const withAction: IrisCommandItem[] = [{ ...items[0]!, action }]
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items: withAction },
      attachTo: document.body,
    })
    await nextTick()
    const surface = document.querySelector('[data-iris-command-palette]') as HTMLElement
    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(action).toHaveBeenCalled()
    expect(wrap.emitted('select')).toBeTruthy()
    expect(wrap.emitted('update:open')?.[0]?.[0]).toBe(false)
    wrap.unmount()
  })

  it('ArrowDown navigates active item', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const surface = document.querySelector('[data-iris-command-palette]') as HTMLElement
    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    const items2 = document.querySelectorAll('[data-iris-command-palette-item]')
    expect(items2[1]?.getAttribute('aria-selected')).toBe('true')
    wrap.unmount()
  })

  it('Escape closes the palette', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const surface = document.querySelector('[data-iris-command-palette]') as HTMLElement
    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrap.emitted('update:open')?.[0]?.[0]).toBe(false)
    wrap.unmount()
  })

  it('Disabled item is aria-disabled', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const disabled = document.querySelector('[data-iris-command-palette-item=pref]') as HTMLElement
    expect(disabled?.getAttribute('aria-disabled')).toBe('true')
    wrap.unmount()
  })

  it('Clicking the backdrop closes', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const backdrop = document.querySelector('[data-iris-command-palette-backdrop]') as HTMLElement
    // jsdom doesn't expose PointerEvent; use a generic Event with the same name.
    const event = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(event, 'target', { value: backdrop, configurable: true })
    Object.defineProperty(event, 'currentTarget', { value: backdrop, configurable: true })
    backdrop.dispatchEvent(event)
    await nextTick()
    expect(wrap.emitted('update:open')?.[0]?.[0]).toBe(false)
    wrap.unmount()
  })

  it('Body scroll lock engages while open', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    wrap.unmount()
  })

  it('Reopening resets query', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const input = document.querySelector('[data-iris-command-palette-input]') as HTMLInputElement
    input.value = 'save'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await wrap.setProps({ open: false })
    await nextTick()
    await wrap.setProps({ open: true })
    await nextTick()
    const inputAgain = document.querySelector(
      '[data-iris-command-palette-input]',
    ) as HTMLInputElement
    expect(inputAgain.value).toBe('')
    wrap.unmount()
  })

  it('Shortcut hint renders when provided', async () => {
    const wrap = mount(IrisCommandPalette, {
      props: { open: true, items },
      attachTo: document.body,
    })
    await nextTick()
    const shortcuts = document.querySelectorAll('[data-iris-command-palette-shortcut]')
    expect(shortcuts.length).toBe(2)
    expect(shortcuts[0]?.textContent).toBe('⌘O')
    wrap.unmount()
  })
})
