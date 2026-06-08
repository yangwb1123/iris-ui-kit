import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisAnchor from './IrisAnchor.svelte'

const items = [
  { href: '#intro', title: 'Introduction' },
  { href: '#usage', title: 'Usage' },
]

describe('IrisAnchor', () => {
  it('renders nav element', () => {
    const { container } = render(IrisAnchor, { props: { items } })
    expect(container.querySelector('nav[data-iris-anchor]')).not.toBeNull()
  })

  it('renders anchor links for each item', () => {
    const { container } = render(IrisAnchor, { props: { items } })
    const links = container.querySelectorAll('[data-iris-anchor-link]')
    expect(links.length).toBe(2)
  })

  it('shows item titles', () => {
    const { getByText } = render(IrisAnchor, { props: { items } })
    expect(getByText('Introduction')).toBeTruthy()
    expect(getByText('Usage')).toBeTruthy()
  })
})
