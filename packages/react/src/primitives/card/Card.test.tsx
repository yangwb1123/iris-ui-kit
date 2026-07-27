import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisCard } from './Card'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisCard', () => {
  it('renders the default children in a body', () => {
    const { container } = render(<IrisCard>hello</IrisCard>)
    const body = container.querySelector('[data-iris-card-body]')!
    expect(body.textContent).toBe('hello')
  })

  it('omits header when not provided', () => {
    const { container } = render(<IrisCard>body</IrisCard>)
    expect(container.querySelector('[data-iris-card-header]')).toBeNull()
  })

  it('renders header / body / footer all together', () => {
    const { container } = render(
      <IrisCard header={<h3>Title</h3>} footer={<button>Action</button>}>
        Body
      </IrisCard>,
    )
    expect(container.querySelector('[data-iris-card-header]')).not.toBeNull()
    expect(container.querySelector('[data-iris-card-body]')).not.toBeNull()
    expect(container.querySelector('[data-iris-card-footer]')).not.toBeNull()
  })

  it('elevated variant uses box-shadow', () => {
    const { container } = render(<IrisCard variant="elevated">x</IrisCard>)
    expect(container.querySelector('[data-iris-card]')!.getAttribute('style')!).toContain(
      'box-shadow',
    )
  })

  it('outline variant uses border', () => {
    const { container } = render(<IrisCard variant="outline">x</IrisCard>)
    expect(container.querySelector('[data-iris-card]')!.getAttribute('style')!).toContain(
      'var(--iris-border)',
    )
  })

  it('subtle variant uses surface', () => {
    const { container } = render(<IrisCard variant="subtle">x</IrisCard>)
    expect(container.querySelector('[data-iris-card]')!.getAttribute('style')!).toContain(
      'var(--iris-surface)',
    )
  })

  it('exposes data attrs', () => {
    const { container } = render(
      <IrisCard variant="subtle" padding="lg" hover>
        x
      </IrisCard>,
    )
    const card = container.querySelector('[data-iris-card]')!
    expect(card.getAttribute('data-iris-card-variant')).toBe('subtle')
    expect(card.getAttribute('data-iris-card-padding')).toBe('lg')
    expect(card.getAttribute('data-iris-card-hover')).toBe('true')
  })

  it('padding="none" yields zero section padding', () => {
    const { container } = render(<IrisCard padding="none">x</IrisCard>)
    expect(container.querySelector('[data-iris-card-body]')!.getAttribute('style')!).toContain(
      'padding: 0',
    )
  })
})
