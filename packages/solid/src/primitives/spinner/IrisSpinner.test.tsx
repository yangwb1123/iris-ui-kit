import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisSpinner, resetSpinnerStyles } from './IrisSpinner'

beforeEach(resetSpinnerStyles)
afterEach(cleanup)

describe('IrisSpinner', () => {
  it('renders with role=status', () => {
    const { container } = render(() => <IrisSpinner />)
    const wrap = container.querySelector('[data-iris-spinner-wrap]')
    expect(wrap?.getAttribute('role')).toBe('status')
  })

  it('renders SVG circle', () => {
    const { container } = render(() => <IrisSpinner />)
    expect(container.querySelector('svg[data-iris-spinner]')).not.toBeNull()
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('injects spinner styles on mount', () => {
    render(() => <IrisSpinner />)
    expect(document.getElementById('iris-spinner-styles')).not.toBeNull()
  })

  it('renders custom label as sr-only text', () => {
    const { getByText } = render(() => <IrisSpinner label="Please wait" />)
    expect(getByText('Please wait')).toBeTruthy()
  })

  it('renders no sr-only span when label is empty string', () => {
    const { container } = render(() => <IrisSpinner label="" />)
    const wrap = container.querySelector('[data-iris-spinner-wrap]')!
    // Only the SVG, no span
    expect(wrap.querySelector('span')).toBeNull()
  })
})
