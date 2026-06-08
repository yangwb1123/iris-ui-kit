import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisEmptyState } from './IrisEmptyState'

afterEach(cleanup)

describe('IrisEmptyState', () => {
  it('renders with title and description', () => {
    const { getByText } = render(() => (
      <IrisEmptyState title="No results" description="Try a different search" />
    ))
    expect(getByText('No results')).toBeTruthy()
    expect(getByText('Try a different search')).toBeTruthy()
  })

  it('renders icon when provided', () => {
    const { container } = render(() => <IrisEmptyState title="Empty" icon={<span>📂</span>} />)
    expect(container.querySelector('[data-iris-empty-state-icon]')).not.toBeNull()
  })

  it('renders action when provided', () => {
    const { container } = render(() => (
      <IrisEmptyState title="Empty" action={<button>Create</button>} />
    ))
    expect(container.querySelector('[data-iris-empty-state-action]')).not.toBeNull()
    expect(container.querySelector('button')).not.toBeNull()
  })

  it('has role=status', () => {
    const { container } = render(() => <IrisEmptyState title="None" />)
    expect(container.querySelector('[data-iris-empty-state]')?.getAttribute('role')).toBe('status')
  })
})
