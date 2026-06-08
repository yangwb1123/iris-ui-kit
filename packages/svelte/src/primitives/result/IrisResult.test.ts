import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisResult from './IrisResult.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte IrisResult', () => {
  it('renders the root element with data-iris-result', () => {
    const { container } = render(IrisResult)
    expect(container.querySelector('[data-iris-result]')).not.toBeNull()
  })

  it('sets data-status attribute', () => {
    const { container } = render(IrisResult, { props: { status: 'success' } })
    expect(container.querySelector('[data-status="success"]')).not.toBeNull()
  })

  it('renders the success glyph by default for success status', () => {
    const { container } = render(IrisResult, { props: { status: 'success' } })
    expect(container.querySelector('[data-iris-result-icon]')!.textContent?.trim()).toBe('✓')
  })

  it('renders title and subtitle when provided', () => {
    const { container } = render(IrisResult, {
      props: { title: 'Done!', subtitle: 'Your request was processed.' },
    })
    expect(container.querySelector('[data-iris-result-title]')!.textContent).toContain('Done!')
    expect(container.querySelector('[data-iris-result-subtitle]')!.textContent).toContain(
      'Your request was processed.',
    )
  })

  it('does not render title/subtitle divs when omitted', () => {
    const { container } = render(IrisResult)
    expect(container.querySelector('[data-iris-result-title]')).toBeNull()
    expect(container.querySelector('[data-iris-result-subtitle]')).toBeNull()
  })
})
