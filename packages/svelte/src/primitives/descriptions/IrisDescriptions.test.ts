import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisDescriptions from './IrisDescriptions.svelte'

afterEach(cleanup)

const ITEMS = [
  { label: 'Name', value: 'Alice' },
  { label: 'Role', value: 'Admin' },
]

describe('@iris-ui/svelte IrisDescriptions', () => {
  it('renders a dl element', () => {
    const { container } = render(IrisDescriptions, { props: { items: ITEMS } })
    expect(container.querySelector('dl[data-iris-descriptions]')).not.toBeNull()
  })

  it('renders labels and values', () => {
    const { container } = render(IrisDescriptions, { props: { items: ITEMS } })
    const labels = container.querySelectorAll('[data-iris-descriptions-label]')
    const values = container.querySelectorAll('[data-iris-descriptions-value]')
    expect(labels).toHaveLength(2)
    expect(values).toHaveLength(2)
    expect(labels[0].textContent).toBe('Name')
    expect(values[0].textContent).toBe('Alice')
  })

  it('uses vertical layout with wrapper divs', () => {
    const { container } = render(IrisDescriptions, {
      props: { items: ITEMS, layout: 'vertical' },
    })
    expect(container.querySelectorAll('[data-iris-descriptions-item]')).toHaveLength(2)
  })

  it('sets data-layout attribute', () => {
    const { container } = render(IrisDescriptions, {
      props: { items: ITEMS, layout: 'vertical' },
    })
    expect(container.querySelector('[data-layout="vertical"]')).not.toBeNull()
  })
})
