import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisFieldset from './IrisFieldset.svelte'

describe('IrisFieldset', () => {
  it('renders a fieldset element', () => {
    const { container } = render(IrisFieldset)
    const fs = container.querySelector('[data-iris-fieldset]')
    expect(fs).toBeTruthy()
    expect(fs!.tagName.toLowerCase()).toBe('fieldset')
  })

  it('renders legend when provided', () => {
    const { container } = render(IrisFieldset, { props: { legend: 'My Group' } })
    const legend = container.querySelector('[data-iris-fieldset-legend]')
    expect(legend!.textContent?.trim()).toBe('My Group')
  })

  it('disables the fieldset', () => {
    const { container } = render(IrisFieldset, { props: { disabled: true } })
    const fs = container.querySelector('[data-iris-fieldset]') as HTMLFieldSetElement
    expect(fs.disabled).toBe(true)
  })
})
