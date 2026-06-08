import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisRibbon } from './IrisRibbon'

afterEach(cleanup)

describe('IrisRibbon', () => {
  it('renders the ribbon badge text', () => {
    const { getByText } = render(() => (
      <IrisRibbon text="New">
        <div>Card</div>
      </IrisRibbon>
    ))
    expect(getByText('New')).toBeTruthy()
  })

  it('renders children', () => {
    const { getByText } = render(() => (
      <IrisRibbon text="Sale">
        <div>Product</div>
      </IrisRibbon>
    ))
    expect(getByText('Product')).toBeTruthy()
  })

  it('sets placement data attribute', () => {
    const { container } = render(() => (
      <IrisRibbon text="Hot" placement="start">
        <div />
      </IrisRibbon>
    ))
    expect(container.querySelector('[data-placement="start"]')).not.toBeNull()
  })

  it('defaults to end placement', () => {
    const { container } = render(() => (
      <IrisRibbon text="Top">
        <div />
      </IrisRibbon>
    ))
    expect(container.querySelector('[data-placement="end"]')).not.toBeNull()
  })
})
