import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import IrisList from './IrisList.svelte'

afterEach(cleanup)

const ITEMS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry', disabled: true },
]

describe('@iris-ui-kit/svelte IrisList', () => {
  it('renders a ul with role=listbox', () => {
    const { container } = render(IrisList, { props: { items: ITEMS } })
    expect(container.querySelector('ul[role="listbox"][data-iris-list]')).not.toBeNull()
  })

  it('renders one li per item', () => {
    const { container } = render(IrisList, { props: { items: ITEMS } })
    expect(container.querySelectorAll('[data-iris-list-item]')).toHaveLength(3)
  })

  it('sets aria-selected=false for unselected items', () => {
    const { container } = render(IrisList, { props: { items: ITEMS } })
    const opts = container.querySelectorAll('[role="option"]')
    opts.forEach((opt) => expect(opt.getAttribute('aria-selected')).toBe('false'))
  })

  it('marks disabled item with aria-disabled', () => {
    const { container } = render(IrisList, { props: { items: ITEMS } })
    const cherry = container.querySelectorAll('[data-iris-list-item]')[2]
    expect(cherry.getAttribute('aria-disabled')).toBe('true')
  })

  it('shows empty state when items is empty', () => {
    const { container } = render(IrisList, { props: { items: [] } })
    expect(container.querySelector('[data-iris-list-state="empty"]')).not.toBeNull()
  })

  it('sets aria-multiselectable=true when multi=true', () => {
    const { container } = render(IrisList, { props: { items: ITEMS, multi: true } })
    expect(container.querySelector('ul')!.getAttribute('aria-multiselectable')).toBe('true')
  })

  it('clicking an option emits onValueChange and selects it (uncontrolled)', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisList, { props: { items: ITEMS, onValueChange } })
    const opts = container.querySelectorAll<HTMLElement>('[role="option"]')
    await fireEvent.click(opts[1]!)
    expect(onValueChange).toHaveBeenCalledWith('b')
    expect(opts[1]!.getAttribute('aria-selected')).toBe('true')
  })

  it('ArrowDown moves the roving tabindex to the next enabled option', async () => {
    const { container } = render(IrisList, { props: { items: ITEMS } })
    const ul = container.querySelector('ul')!
    const opts = container.querySelectorAll<HTMLElement>('[role="option"]')
    expect(opts[0]!.getAttribute('tabindex')).toBe('0')
    await fireEvent.keyDown(ul, { key: 'ArrowDown' })
    expect(opts[1]!.getAttribute('tabindex')).toBe('0')
    expect(opts[0]!.getAttribute('tabindex')).toBe('-1')
  })

  it('ArrowDown skips disabled options (Cherry is disabled)', async () => {
    const { container } = render(IrisList, { props: { items: ITEMS } })
    const ul = container.querySelector('ul')!
    const opts = container.querySelectorAll<HTMLElement>('[role="option"]')
    // a(0) -> b(1) -> wrap past disabled c(2) -> back to a(0)
    await fireEvent.keyDown(ul, { key: 'ArrowDown' })
    await fireEvent.keyDown(ul, { key: 'ArrowDown' })
    expect(opts[0]!.getAttribute('tabindex')).toBe('0')
  })

  it('Enter selects the active option', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisList, { props: { items: ITEMS, onValueChange } })
    const ul = container.querySelector('ul')!
    await fireEvent.keyDown(ul, { key: 'ArrowDown' })
    await fireEvent.keyDown(ul, { key: 'Enter' })
    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('multi mode toggles values into an array', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisList, {
      props: { items: ITEMS, multi: true, onValueChange },
    })
    const opts = container.querySelectorAll<HTMLElement>('[role="option"]')
    await fireEvent.click(opts[0]!)
    await fireEvent.click(opts[1]!)
    expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b'])
  })

  it('renders the loading state with aria-busy', () => {
    const { container } = render(IrisList, { props: { items: ITEMS, loading: true } })
    expect(container.querySelector('[data-iris-list-state="loading"]')).not.toBeNull()
    expect(container.querySelector('ul')!.getAttribute('aria-busy')).toBe('true')
  })

  it('error state takes precedence over loading', () => {
    const { container } = render(IrisList, {
      props: { items: ITEMS, loading: true, error: true },
    })
    expect(container.querySelector('[data-iris-list-state="error"]')).not.toBeNull()
  })
})
