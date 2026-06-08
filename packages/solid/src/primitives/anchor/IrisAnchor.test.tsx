import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisAnchor } from './IrisAnchor'

afterEach(cleanup)

const items = [
  { href: '#section1', title: 'Section 1' },
  { href: '#section2', title: 'Section 2' },
]

describe('IrisAnchor', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisAnchor items={items} />)
    expect(container.querySelector('[data-iris-anchor]')).not.toBeNull()
  })

  it('renders all anchor items', () => {
    const { container } = render(() => <IrisAnchor items={items} />)
    const links = container.querySelectorAll('[data-iris-anchor-link]')
    expect(links.length).toBe(2)
  })

  it('renders link titles', () => {
    const { getByText } = render(() => <IrisAnchor items={items} />)
    expect(getByText('Section 1')).toBeTruthy()
    expect(getByText('Section 2')).toBeTruthy()
  })

  it('renders with ariaLabel on nav', () => {
    const { container } = render(() => <IrisAnchor items={items} ariaLabel="Page sections" />)
    expect(container.querySelector('[aria-label="Page sections"]')).not.toBeNull()
  })
})
