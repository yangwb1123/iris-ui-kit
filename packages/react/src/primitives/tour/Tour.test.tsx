import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTour } from './Tour'

afterEach(() => cleanup())

const STEPS = [{ title: 'A', description: 'da' }, { title: 'B' }, { title: 'C' }]
const card = (c: HTMLElement) => c.querySelector('[data-iris-tour-card]')

describe('@iris-ui-kit/react IrisTour', () => {
  it('is hidden by default', () => {
    const { container } = render(<IrisTour steps={STEPS} />)
    expect(card(container)).toBeNull()
  })

  it('shows the first step when open', () => {
    const { container } = render(<IrisTour steps={STEPS} defaultOpen />)
    expect(container.querySelector('[data-iris-tour-title]')?.textContent).toBe('A')
    expect(container.querySelector('[data-iris-tour-indicator]')?.textContent).toBe('Step 1 of 3')
  })

  it('Next advances and Prev goes back', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisTour steps={STEPS} defaultOpen onChange={onChange} />)
    fireEvent.click(container.querySelector('[data-iris-tour-next]')!)
    expect(onChange).toHaveBeenLastCalledWith(1)
    expect(container.querySelector('[data-iris-tour-title]')?.textContent).toBe('B')
    fireEvent.click(container.querySelector('[data-iris-tour-prev]')!)
    expect(container.querySelector('[data-iris-tour-title]')?.textContent).toBe('A')
  })

  it('the last step finishes and closes', () => {
    const onFinish = vi.fn()
    const { container } = render(
      <IrisTour steps={[{ title: 'Only' }]} defaultOpen onFinish={onFinish} />,
    )
    expect(container.querySelector('[data-iris-tour-next]')?.textContent).toBe('Finish')
    fireEvent.click(container.querySelector('[data-iris-tour-next]')!)
    expect(onFinish).toHaveBeenCalled()
    expect(card(container)).toBeNull()
  })

  it('Skip closes', () => {
    const onClose = vi.fn()
    const { container } = render(<IrisTour steps={STEPS} defaultOpen onClose={onClose} />)
    fireEvent.click(container.querySelector('[data-iris-tour-skip]')!)
    expect(onClose).toHaveBeenCalled()
    expect(card(container)).toBeNull()
  })

  it('a11y: the card is a dialog', () => {
    const { container } = render(<IrisTour steps={STEPS} defaultOpen />)
    expect(card(container)?.getAttribute('role')).toBe('dialog')
  })
})
