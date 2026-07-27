import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisFieldset } from './Fieldset'

afterEach(() => cleanup())

const fs = (c: HTMLElement) => c.querySelector('[data-iris-fieldset]') as HTMLFieldSetElement

describe('@iris-ui-kit/react IrisFieldset', () => {
  it('renders the legend and children', () => {
    const { container } = render(
      <IrisFieldset legend="Account">
        <input data-child="" />
      </IrisFieldset>,
    )
    expect(container.querySelector('[data-iris-fieldset-legend]')?.textContent).toBe('Account')
    expect(container.querySelector('[data-child]')).not.toBeNull()
  })

  it('disables the group natively', () => {
    const { container } = render(
      <IrisFieldset legend="x" disabled>
        <input />
      </IrisFieldset>,
    )
    expect(fs(container).disabled).toBe(true)
  })

  it('is enabled by default', () => {
    const { container } = render(
      <IrisFieldset legend="x">
        <input />
      </IrisFieldset>,
    )
    expect(fs(container).disabled).toBe(false)
  })

  it('renders a hint', () => {
    const { container } = render(
      <IrisFieldset legend="x" hint="Required fields">
        <input />
      </IrisFieldset>,
    )
    expect(container.querySelector('[data-iris-fieldset-hint]')?.textContent).toBe(
      'Required fields',
    )
  })
})
