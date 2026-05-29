import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisRibbon } from './Ribbon'

afterEach(() => cleanup())

const badge = (c: HTMLElement) => c.querySelector('[data-iris-ribbon-badge]') as HTMLElement
const root = (c: HTMLElement) => c.querySelector('[data-iris-ribbon]')

describe('@iris-ui/react IrisRibbon', () => {
  it('renders the badge text and children', () => {
    const { container } = render(
      <IrisRibbon text="New">
        <div data-child="">Card</div>
      </IrisRibbon>,
    )
    expect(badge(container).textContent).toBe('New')
    expect(container.querySelector('[data-child]')?.textContent).toBe('Card')
  })

  it('defaults to the end placement', () => {
    const { container } = render(<IrisRibbon text="x" />)
    expect(root(container)?.getAttribute('data-placement')).toBe('end')
  })

  it('supports the start placement', () => {
    const { container } = render(<IrisRibbon text="x" placement="start" />)
    expect(root(container)?.getAttribute('data-placement')).toBe('start')
  })

  it('applies a custom color', () => {
    const { container } = render(<IrisRibbon text="x" color="rgb(1, 2, 3)" />)
    expect(badge(container).style.background).toBe('rgb(1, 2, 3)')
  })
})
