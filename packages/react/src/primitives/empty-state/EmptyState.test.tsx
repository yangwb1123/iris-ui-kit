import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisEmptyState } from './EmptyState'

afterEach(() => cleanup())

describe('@iris-ui/react IrisEmptyState', () => {
  it('renders with role status', () => {
    const { container } = render(<IrisEmptyState title="None" />)
    expect(container.querySelector('[data-iris-empty-state]')!.getAttribute('role')).toBe('status')
  })

  it('renders title + description', () => {
    const { container } = render(<IrisEmptyState title="No data" description="Try again" />)
    expect(container.querySelector('[data-iris-empty-state-title]')!.textContent).toBe('No data')
    expect(container.querySelector('[data-iris-empty-state-description]')!.textContent).toBe(
      'Try again',
    )
  })

  it('icon + action render', () => {
    const { container } = render(
      <IrisEmptyState title="x" icon={<span>∅</span>} action={<button>New</button>} />,
    )
    expect(container.querySelector('[data-iris-empty-state-icon]')!.textContent).toBe('∅')
    expect(container.querySelector('[data-iris-empty-state-action]')).not.toBeNull()
  })

  it('children fall back to description', () => {
    const { container } = render(<IrisEmptyState>Custom body</IrisEmptyState>)
    expect(container.querySelector('[data-iris-empty-state-description]')!.textContent).toBe(
      'Custom body',
    )
  })

  it('omits title when not given', () => {
    const { container } = render(<IrisEmptyState />)
    expect(container.querySelector('[data-iris-empty-state-title]')).toBeNull()
  })
})
