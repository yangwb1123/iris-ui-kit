import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { IrisButton } from './Button'
import { __BUTTON_STYLE_ID, __resetButtonStyles } from './styles'

afterEach(() => cleanup())

describe('@iris-ui/react IrisButton', () => {
  beforeEach(() => __resetButtonStyles())
  afterEach(() => __resetButtonStyles())

  it('renders a native button', () => {
    render(<IrisButton>Click</IrisButton>)
    const btn = screen.getByRole('button', { name: 'Click' })
    expect(btn.tagName).toBe('BUTTON')
  })

  it('defaults type to button (no accidental form submit)', () => {
    render(<IrisButton>Click</IrisButton>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('fires onClick when interactive', () => {
    const onClick = vi.fn()
    render(<IrisButton onClick={onClick}>Click</IrisButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <IrisButton disabled onClick={onClick}>
        Click
      </IrisButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does NOT fire onClick when loading', () => {
    const onClick = vi.fn()
    render(
      <IrisButton loading onClick={onClick}>
        Click
      </IrisButton>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aria-busy + aria-disabled reflect the props', () => {
    render(<IrisButton loading>X</IrisButton>)
    const a = screen.getByRole('button')
    expect(a.getAttribute('aria-busy')).toBe('true')

    cleanup()
    render(<IrisButton disabled>X</IrisButton>)
    const b = screen.getByRole('button')
    expect(b.getAttribute('aria-disabled')).toBe('true')
  })

  it('renders the leading slot when not loading', () => {
    render(<IrisButton leading={<span data-testid="lead">*</span>}>X</IrisButton>)
    expect(screen.getByTestId('lead')).toBeTruthy()
  })

  it('replaces leading with spinner when loading', () => {
    const { container } = render(
      <IrisButton loading leading={<span data-testid="lead">*</span>}>
        X
      </IrisButton>,
    )
    expect(screen.queryByTestId('lead')).toBeNull()
    expect(container.querySelector('.iris-button-spinner')).not.toBeNull()
  })

  it('variant + size become data attributes', () => {
    render(
      <IrisButton variant="outline" size="lg">
        X
      </IrisButton>,
    )
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('data-iris-button-variant')).toBe('outline')
    expect(btn.getAttribute('data-iris-button-size')).toBe('lg')
  })

  it('inline style references CSS variables', () => {
    render(<IrisButton variant="solid">X</IrisButton>)
    const btn = screen.getByRole('button') as HTMLElement
    const inline = btn.getAttribute('style') ?? ''
    expect(inline).toContain('var(--iris-primary)')
  })

  it('installs styles exactly once across multiple mounts', () => {
    render(<IrisButton>1</IrisButton>)
    render(<IrisButton>2</IrisButton>)
    render(<IrisButton>3</IrisButton>)
    expect(document.querySelectorAll(`#${__BUTTON_STYLE_ID}`)).toHaveLength(1)
  })

  it('asChild renders the child element with merged className + handlers', () => {
    const onClick = vi.fn()
    render(
      <IrisButton asChild onClick={onClick}>
        <a href="/x" className="custom-link" data-testid="anchor">
          go
        </a>
      </IrisButton>,
    )
    const link = screen.getByTestId('anchor') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/x')
    expect(link.className).toContain('iris-button')
    expect(link.className).toContain('custom-link')
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('asChild + disabled still swallows clicks', () => {
    const onClick = vi.fn()
    const childClick = vi.fn()
    render(
      <IrisButton asChild disabled onClick={onClick}>
        <a href="#" onClick={childClick}>
          go
        </a>
      </IrisButton>,
    )
    fireEvent.click(screen.getByText('go'))
    expect(onClick).not.toHaveBeenCalled()
    expect(childClick).not.toHaveBeenCalled()
  })

  it('forwards unlisted native/ARIA props (e.g. aria-label) to the real DOM button', () => {
    render(<IrisButton aria-label="Open command palette">🔍</IrisButton>)
    const btn = screen.getByRole('button', { name: 'Open command palette' })
    expect(btn.getAttribute('aria-label')).toBe('Open command palette')
  })

  it('forwards data-testid and other passthrough attributes', () => {
    render(
      <IrisButton data-testid="toolbar-btn" title="hover text" tabIndex={-1}>
        X
      </IrisButton>,
    )
    const btn = screen.getByTestId('toolbar-btn')
    expect(btn.getAttribute('title')).toBe('hover text')
    expect(btn.getAttribute('tabindex')).toBe('-1')
  })

  it('the component-computed aria-busy/aria-disabled always win over a spoofed value forwarded via rest', () => {
    const spoofed = { 'aria-busy': 'false', 'aria-disabled': 'false' } as Record<string, string>
    render(
      <IrisButton loading disabled {...spoofed}>
        X
      </IrisButton>,
    )
    const btn = screen.getByRole('button')
    // loading/disabled are IrisButton's own named props and drive the real
    // computed state — anything of the same name accidentally present in
    // `rest` must never be able to override them.
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.disabled).toBe(true)
  })

  it('asChild also forwards an unlisted prop (aria-label) onto the cloned child', () => {
    render(
      <IrisButton asChild aria-label="Open command palette">
        <a href="/x" data-testid="anchor">
          go
        </a>
      </IrisButton>,
    )
    const link = screen.getByTestId('anchor')
    expect(link.getAttribute('aria-label')).toBe('Open command palette')
  })
})
