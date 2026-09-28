import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisDivider } from './IrisDivider'

afterEach(cleanup)

describe('IrisDivider', () => {
  it('renders a horizontal hr by default', () => {
    const { container } = render(() => <IrisDivider />)
    expect(container.querySelector('hr[data-iris-divider]')).not.toBeNull()
  })

  it('renders a vertical div with role=separator', () => {
    const { container } = render(() => <IrisDivider orientation="vertical" />)
    const el = container.querySelector('[data-iris-divider-orientation="vertical"]')
    expect(el?.getAttribute('role')).toBe('separator')
  })

  it('renders a label with the canonical letter-spacing token', () => {
    const { getByText, container } = render(() => <IrisDivider label="OR" />)
    expect(getByText('OR')).toBeTruthy()
    expect(container.querySelector('[data-iris-divider-has-label]')).not.toBeNull()
    const style = container.querySelector('[data-iris-divider]')?.getAttribute('style') ?? ''
    expect(style).toContain('--iris-font-letter-spacing-wide')
    expect(style).not.toContain('--iris-letter-spacing-wide')
  })

  it('renders children as label', () => {
    const { getByText } = render(() => (
      <IrisDivider>
        <span>Section</span>
      </IrisDivider>
    ))
    expect(getByText('Section')).toBeTruthy()
  })
})
