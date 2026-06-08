import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisResult } from './IrisResult'

afterEach(cleanup)

describe('IrisResult', () => {
  it('renders the status glyph by default', () => {
    const { container } = render(() => <IrisResult status="success" title="Done" />)
    const icon = container.querySelector('[data-iris-result-icon]')
    expect(icon?.textContent).toBe('✓')
  })

  it('renders title and subtitle', () => {
    const { getByText } = render(() => (
      <IrisResult status="error" title="Failed" subtitle="Please retry" />
    ))
    expect(getByText('Failed')).toBeTruthy()
    expect(getByText('Please retry')).toBeTruthy()
  })

  it('renders custom icon override', () => {
    const { container } = render(() => (
      <IrisResult status="info" icon={<span data-testid="custom-icon">🎉</span>} />
    ))
    expect(container.querySelector('[data-testid="custom-icon"]')).not.toBeNull()
  })

  it('renders extra slot', () => {
    const { container } = render(() => <IrisResult status="success" extra={<button>OK</button>} />)
    expect(container.querySelector('[data-iris-result-extra]')).not.toBeNull()
  })

  it('sets data-status attribute', () => {
    const { container } = render(() => <IrisResult status="warning" />)
    expect(container.querySelector('[data-status="warning"]')).not.toBeNull()
  })
})
