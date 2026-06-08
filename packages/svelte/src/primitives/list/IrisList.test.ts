import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisList from './IrisList.svelte'

afterEach(cleanup)

const ITEMS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry', disabled: true },
]

describe('@iris-ui/svelte IrisList', () => {
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
})
