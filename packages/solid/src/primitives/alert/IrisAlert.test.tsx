import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisAlert } from './IrisAlert'

afterEach(cleanup)

describe('IrisAlert', () => {
  it('renders with content', () => {
    const { getByText } = render(() => <IrisAlert>Something went wrong</IrisAlert>)
    expect(getByText('Something went wrong')).toBeTruthy()
  })

  it('shows the title when provided', () => {
    const { getByText } = render(() => (
      <IrisAlert title="Error" tone="danger">
        Oops
      </IrisAlert>
    ))
    expect(getByText('Error')).toBeTruthy()
  })

  it('applies danger tone as role=alert', () => {
    const { container } = render(() => <IrisAlert tone="danger">Bad</IrisAlert>)
    const el = container.querySelector('[data-iris-alert]')
    expect(el?.getAttribute('role')).toBe('alert')
  })

  it('applies info tone as role=status', () => {
    const { container } = render(() => <IrisAlert tone="info">Info</IrisAlert>)
    const el = container.querySelector('[data-iris-alert]')
    expect(el?.getAttribute('role')).toBe('status')
  })

  it('renders close button when closable', () => {
    const { container } = render(() => <IrisAlert closable>Content</IrisAlert>)
    expect(container.querySelector('[data-iris-alert-close]')).not.toBeNull()
  })

  it('hides when close button is clicked (uncontrolled)', () => {
    const { container, queryByText } = render(() => <IrisAlert closable>Content</IrisAlert>)
    const btn = container.querySelector('[data-iris-alert-close]') as HTMLElement
    fireEvent.click(btn)
    expect(queryByText('Content')).toBeNull()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    const { container } = render(() => (
      <IrisAlert closable onClose={onClose}>
        Content
      </IrisAlert>
    ))
    const btn = container.querySelector('[data-iris-alert-close]') as HTMLElement
    fireEvent.click(btn)
    expect(onClose).toHaveBeenCalled()
  })
})
