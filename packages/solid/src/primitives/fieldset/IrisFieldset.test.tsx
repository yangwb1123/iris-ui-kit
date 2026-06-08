import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisFieldset } from './IrisFieldset'

afterEach(cleanup)

describe('IrisFieldset', () => {
  it('renders fieldset element', () => {
    const { container } = render(() => <IrisFieldset legend="Contact Info" />)
    const fs = container.querySelector('[data-iris-fieldset]')!
    expect(fs.tagName.toLowerCase()).toBe('fieldset')
  })

  it('renders legend text', () => {
    const { getByText } = render(() => <IrisFieldset legend="Personal Details" />)
    expect(getByText('Personal Details')).toBeTruthy()
  })

  it('renders hint text', () => {
    const { getByText } = render(() => <IrisFieldset hint="Required fields" />)
    expect(getByText('Required fields')).toBeTruthy()
  })

  it('disables the fieldset natively', () => {
    const { container } = render(() => (
      <IrisFieldset disabled legend="Disabled Group">
        <input type="text" />
      </IrisFieldset>
    ))
    const fs = container.querySelector('fieldset')!
    // The fieldset element itself should be disabled
    expect(fs.disabled).toBe(true)
  })

  it('renders children inside fieldset', () => {
    const { getByText } = render(() => (
      <IrisFieldset>
        <span>Child content</span>
      </IrisFieldset>
    ))
    expect(getByText('Child content')).toBeTruthy()
  })
})
