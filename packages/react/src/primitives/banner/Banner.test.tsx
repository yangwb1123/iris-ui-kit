import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisBanner } from './Banner'

afterEach(() => cleanup())

describe('@iris-ui/react IrisBanner', () => {
  it('renders edge-to-edge with role="status"', () => {
    const { container } = render(<IrisBanner>Hello</IrisBanner>)
    const el = container.querySelector('[data-iris-banner]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.getAttribute('role')).toBe('status')
    expect(el.style.width).toBe('100%')
  })

  it('tone reflects on data attr', () => {
    render(<IrisBanner tone="warning">x</IrisBanner>)
    expect(
      document.querySelector('[data-iris-banner]')?.getAttribute('data-iris-banner-tone'),
    ).toBe('warning')
  })

  it('closable renders close button; clicking dismisses', () => {
    const { container } = render(<IrisBanner closable>x</IrisBanner>)
    const close = container.querySelector('[data-iris-banner-close]') as HTMLButtonElement
    expect(close).not.toBeNull()
    act(() => {
      fireEvent.click(close)
    })
    expect(container.querySelector('[data-iris-banner]')).toBeNull()
  })

  it('controlled open=false hides the banner', () => {
    render(<IrisBanner open={false}>x</IrisBanner>)
    expect(document.querySelector('[data-iris-banner]')).toBeNull()
  })

  it('close in controlled mode emits onOpenChange(false) without hiding', () => {
    const onChange = vi.fn()
    render(
      <IrisBanner open closable onOpenChange={onChange}>
        x
      </IrisBanner>,
    )
    const close = document.querySelector('[data-iris-banner-close]') as HTMLButtonElement
    act(() => {
      fireEvent.click(close)
    })
    expect(onChange).toHaveBeenCalledWith(false)
    // Still rendered because parent controls open.
    expect(document.querySelector('[data-iris-banner]')).not.toBeNull()
  })

  it('sticky sets position:sticky', () => {
    render(<IrisBanner sticky>x</IrisBanner>)
    expect((document.querySelector('[data-iris-banner]') as HTMLElement).style.position).toBe(
      'sticky',
    )
  })

  it('renders icon and actions slots', () => {
    render(
      <IrisBanner
        icon={<span data-testid="icon">i</span>}
        actions={<button data-testid="action">Go</button>}
      >
        x
      </IrisBanner>,
    )
    expect(document.querySelector('[data-testid=icon]')).not.toBeNull()
    expect(document.querySelector('[data-testid=action]')).not.toBeNull()
  })

  it('non-closable omits close button', () => {
    render(<IrisBanner>x</IrisBanner>)
    expect(document.querySelector('[data-iris-banner-close]')).toBeNull()
  })
})
