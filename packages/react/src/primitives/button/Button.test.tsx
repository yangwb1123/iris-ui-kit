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
    render(
      <IrisButton leading={<span data-testid="lead">*</span>}>X</IrisButton>,
    )
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
})
