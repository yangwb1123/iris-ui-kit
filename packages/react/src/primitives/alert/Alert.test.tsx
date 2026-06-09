import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisAlert } from './Alert'
import { IrisI18nProvider } from '../../i18n'

afterEach(() => cleanup())

describe('@iris-ui/react IrisAlert', () => {
  it('renders children', () => {
    const { container } = render(<IrisAlert>msg</IrisAlert>)
    expect(container.textContent).toContain('msg')
  })

  it('role="alert" for warning/danger, "status" otherwise', () => {
    const { container, rerender } = render(<IrisAlert tone="info">x</IrisAlert>)
    expect(container.querySelector('[data-iris-alert]')!.getAttribute('role')).toBe('status')
    rerender(<IrisAlert tone="warning">x</IrisAlert>)
    expect(container.querySelector('[data-iris-alert]')!.getAttribute('role')).toBe('alert')
    rerender(<IrisAlert tone="danger">x</IrisAlert>)
    expect(container.querySelector('[data-iris-alert]')!.getAttribute('role')).toBe('alert')
  })

  it('renders the title', () => {
    const { container } = render(<IrisAlert title="Heads up">body</IrisAlert>)
    expect(container.querySelector('[data-iris-alert-title]')!.textContent).toBe('Heads up')
  })

  it('omits title element when not provided', () => {
    const { container } = render(<IrisAlert>body</IrisAlert>)
    expect(container.querySelector('[data-iris-alert-title]')).toBeNull()
  })

  it('renders icon node', () => {
    const { container } = render(<IrisAlert icon={<span>X</span>}>body</IrisAlert>)
    expect(container.querySelector('[data-iris-alert-icon]')!.textContent).toBe('X')
  })

  it('no close by default', () => {
    const { container } = render(<IrisAlert>body</IrisAlert>)
    expect(container.querySelector('[data-iris-alert-close]')).toBeNull()
  })

  it('closable=true renders close button + calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <IrisAlert closable onClose={onClose}>
        body
      </IrisAlert>,
    )
    fireEvent.click(container.querySelector('[data-iris-alert-close]')!)
    expect(onClose).toHaveBeenCalled()
  })

  it('close button aria-label defaults to English and localizes via i18n', () => {
    const plain = render(<IrisAlert closable>body</IrisAlert>)
    expect(
      plain.container.querySelector('[data-iris-alert-close]')!.getAttribute('aria-label'),
    ).toBe('Close')
    plain.unmount()
    const { container } = render(
      <IrisI18nProvider messages={{ 'alert.close': 'Fermer' }}>
        <IrisAlert closable>body</IrisAlert>
      </IrisI18nProvider>,
    )
    expect(container.querySelector('[data-iris-alert-close]')!.getAttribute('aria-label')).toBe(
      'Fermer',
    )
  })

  it('uncontrolled close hides the alert', () => {
    const { container } = render(<IrisAlert closable>body</IrisAlert>)
    expect(container.querySelector('[data-iris-alert]')).not.toBeNull()
    fireEvent.click(container.querySelector('[data-iris-alert-close]')!)
    expect(container.querySelector('[data-iris-alert]')).toBeNull()
  })

  it('controlled close does NOT auto-hide', () => {
    const { container } = render(
      <IrisAlert open closable>
        body
      </IrisAlert>,
    )
    fireEvent.click(container.querySelector('[data-iris-alert-close]')!)
    expect(container.querySelector('[data-iris-alert]')).not.toBeNull()
  })
})
