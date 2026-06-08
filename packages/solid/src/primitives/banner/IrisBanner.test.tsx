import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisBanner } from './IrisBanner'

afterEach(cleanup)

describe('IrisBanner', () => {
  it('renders banner content', () => {
    const { getByText, container } = render(() => <IrisBanner>Update available</IrisBanner>)
    expect(getByText('Update available')).toBeTruthy()
    expect(container.querySelector('[data-iris-banner]')).not.toBeNull()
  })

  it('does not render when open=false', () => {
    const { container } = render(() => <IrisBanner open={false}>Hidden</IrisBanner>)
    expect(container.querySelector('[data-iris-banner]')).toBeNull()
  })

  it('closes banner when close button clicked (uncontrolled)', () => {
    const { container } = render(() => <IrisBanner closable>Message</IrisBanner>)
    expect(container.querySelector('[data-iris-banner]')).not.toBeNull()
    fireEvent.click(container.querySelector('[data-iris-banner-close]') as HTMLButtonElement)
    expect(container.querySelector('[data-iris-banner]')).toBeNull()
  })

  it('calls onClose when closed', () => {
    const onClose = vi.fn()
    const { container } = render(() => (
      <IrisBanner closable onClose={onClose}>
        Msg
      </IrisBanner>
    ))
    fireEvent.click(container.querySelector('[data-iris-banner-close]') as HTMLButtonElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('applies tone data attribute', () => {
    const { container } = render(() => <IrisBanner tone="warning">Caution</IrisBanner>)
    expect(container.querySelector('[data-iris-banner-tone="warning"]')).not.toBeNull()
  })
})
