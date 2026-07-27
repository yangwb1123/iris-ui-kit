import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisEmptyState from './IrisEmptyState.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisEmptyState', () => {
  it('renders with role=status', () => {
    const { container } = render(IrisEmptyState)
    const el = container.querySelector('[data-iris-empty-state]')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('role')).toBe('status')
  })

  it('renders title from prop', () => {
    const { container } = render(IrisEmptyState, { props: { title: 'No items found' } })
    expect(container.querySelector('[data-iris-empty-state-title]')!.textContent).toContain(
      'No items found',
    )
  })

  it('renders description from prop', () => {
    const { container } = render(IrisEmptyState, {
      props: { description: 'Create one to get started' },
    })
    expect(container.querySelector('[data-iris-empty-state-description]')!.textContent).toContain(
      'Create one to get started',
    )
  })

  it('does not render title/description divs when omitted', () => {
    const { container } = render(IrisEmptyState)
    expect(container.querySelector('[data-iris-empty-state-title]')).toBeNull()
    expect(container.querySelector('[data-iris-empty-state-description]')).toBeNull()
  })
})
