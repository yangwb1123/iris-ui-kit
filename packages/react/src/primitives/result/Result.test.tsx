import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisResult } from './Result'

afterEach(() => cleanup())

describe('@iris-ui/react IrisResult', () => {
  it('renders title and subtitle', () => {
    const { container } = render(<IrisResult title="Done" subtitle="All good" />)
    expect(container.querySelector('[data-iris-result-title]')?.textContent).toBe('Done')
    expect(container.querySelector('[data-iris-result-subtitle]')?.textContent).toBe('All good')
  })

  it('reflects the status and its default glyph', () => {
    const { container } = render(<IrisResult status="success" title="OK" />)
    expect(container.querySelector('[data-iris-result]')?.getAttribute('data-status')).toBe(
      'success',
    )
    expect(container.querySelector('[data-iris-result-icon]')?.textContent).toBe('✓')
  })

  it('defaults to the info status', () => {
    const { container } = render(<IrisResult title="Note" />)
    expect(container.querySelector('[data-iris-result]')?.getAttribute('data-status')).toBe('info')
  })

  it('allows overriding the icon', () => {
    const { container } = render(<IrisResult icon={<span data-custom-icon="">★</span>} title="X" />)
    expect(container.querySelector('[data-custom-icon]')?.textContent).toBe('★')
  })

  it('renders extra actions and content', () => {
    const { container } = render(
      <IrisResult title="Error" extra={<button>Retry</button>}>
        <code data-details="">stack</code>
      </IrisResult>,
    )
    expect(container.querySelector('[data-iris-result-extra] button')?.textContent).toBe('Retry')
    expect(container.querySelector('[data-iris-result-content] [data-details]')?.textContent).toBe(
      'stack',
    )
  })

  it('marks the icon decorative', () => {
    const { container } = render(<IrisResult status="error" title="Oops" />)
    expect(container.querySelector('[data-iris-result-icon]')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })
})
