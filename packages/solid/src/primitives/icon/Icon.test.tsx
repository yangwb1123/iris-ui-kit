import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisIcon } from './Icon'

afterEach(cleanup)

describe('@iris-ui-kit/solid IrisIcon', () => {
  it('renders a registered icon as inline SVG with structured nodes', () => {
    const { container } = render(() => <IrisIcon name="chevron-down" />)
    const svg = container.querySelector('svg[data-iris-icon="chevron-down"]')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
    expect(svg!.querySelector('polyline, path, line, circle, rect')).not.toBeNull()
  })

  it('sets role=img + aria-label + <title> when titled', () => {
    const { container } = render(() => <IrisIcon name="check" title="Done" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Done')
    expect(svg.querySelector('title')!.textContent).toBe('Done')
  })

  it('renders nothing for an unknown icon name', () => {
    const { container } = render(() => <IrisIcon name="definitely-not-an-icon" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
