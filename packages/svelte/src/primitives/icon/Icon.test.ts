import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisIcon from './IrisIcon.svelte'

afterEach(cleanup)

const SVG_NS = 'http://www.w3.org/2000/svg'

describe('@iris-ui/svelte IrisIcon', () => {
  it('renders a registered icon as inline SVG with structured nodes', () => {
    const { container } = render(IrisIcon, { props: { name: 'chevron-down' } })
    const svg = container.querySelector('svg[data-iris-icon="chevron-down"]')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
    const node = svg!.querySelector('polyline, path, line, circle, rect')
    expect(node).not.toBeNull()
    // structured children must be real SVG-namespaced elements, not HTML.
    expect(node!.namespaceURI).toBe(SVG_NS)
  })

  it('sets role=img + aria-label + <title> when titled', () => {
    const { container } = render(IrisIcon, { props: { name: 'check', title: 'Done' } })
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Done')
    expect(svg.querySelector('title')!.textContent).toBe('Done')
  })

  it('renders nothing for an unknown icon name', () => {
    const { container } = render(IrisIcon, { props: { name: 'definitely-not-an-icon' } })
    expect(container.querySelector('svg')).toBeNull()
  })
})
