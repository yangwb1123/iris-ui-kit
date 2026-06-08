import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisCard } from './IrisCard'

afterEach(cleanup)

describe('IrisCard', () => {
  it('renders children in the body', () => {
    const { getByText } = render(() => <IrisCard>Card content</IrisCard>)
    expect(getByText('Card content')).toBeTruthy()
  })

  it('renders header and footer slots', () => {
    const { container } = render(() => (
      <IrisCard header={<span>Header</span>} footer={<span>Footer</span>}>
        Body
      </IrisCard>
    ))
    expect(container.querySelector('[data-iris-card-header]')).not.toBeNull()
    expect(container.querySelector('[data-iris-card-footer]')).not.toBeNull()
  })

  it('does not render header/footer divs when not provided', () => {
    const { container } = render(() => <IrisCard>Body only</IrisCard>)
    expect(container.querySelector('[data-iris-card-header]')).toBeNull()
    expect(container.querySelector('[data-iris-card-footer]')).toBeNull()
  })

  it('applies variant data attribute', () => {
    const { container } = render(() => <IrisCard variant="outline">Content</IrisCard>)
    expect(container.querySelector('[data-iris-card-variant="outline"]')).not.toBeNull()
  })

  it('defaults to elevated variant', () => {
    const { container } = render(() => <IrisCard>Content</IrisCard>)
    expect(container.querySelector('[data-iris-card-variant="elevated"]')).not.toBeNull()
  })
})
