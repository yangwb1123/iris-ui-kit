import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte'
import IrisButton from './IrisButton.svelte'
import ButtonAsChildHarness from './ButtonAsChildHarness.svelte'
import { __resetButtonStyles, __BUTTON_STYLE_ID } from './styles'

afterEach(() => {
  cleanup()
  __resetButtonStyles()
})

describe('@iris-ui-kit/svelte IrisButton', () => {
  it('renders a native button with default type', () => {
    render(IrisButton)
    const btn = screen.getByRole('button')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('reflects variant + size via data attributes', () => {
    render(IrisButton, { props: { variant: 'outline', size: 'lg' } })
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('data-iris-button-variant')).toBe('outline')
    expect(btn.getAttribute('data-iris-button-size')).toBe('lg')
  })

  it('calls onclick when interactive', async () => {
    const onclick = vi.fn()
    render(IrisButton, { props: { onclick } })
    await fireEvent.click(screen.getByRole('button'))
    expect(onclick).toHaveBeenCalledTimes(1)
  })

  it('swallows clicks when disabled or loading', async () => {
    const onclick = vi.fn()
    const { unmount } = render(IrisButton, { props: { disabled: true, onclick } })
    await fireEvent.click(screen.getByRole('button'))
    expect(onclick).not.toHaveBeenCalled()
    unmount()
    render(IrisButton, { props: { loading: true, onclick } })
    await fireEvent.click(screen.getByRole('button'))
    expect(onclick).not.toHaveBeenCalled()
  })

  it('sets aria-busy + disabled and shows a spinner when loading', () => {
    render(IrisButton, { props: { loading: true } })
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(document.querySelector('.iris-button-spinner')).not.toBeNull()
  })

  it('inline style references CSS variables', () => {
    render(IrisButton, { props: { variant: 'solid' } })
    expect(screen.getByRole('button').getAttribute('style') ?? '').toContain('var(--iris-primary)')
  })

  it('size uses the shared control-height tokens', () => {
    const { container } = render(IrisButton, { props: { size: 'lg' } })
    expect(container.querySelector('button')!.getAttribute('style')).toContain(
      'min-height: var(--iris-control-height-lg, 40px)',
    )
  })

  it('installs the singleton stylesheet once', () => {
    render(IrisButton)
    render(IrisButton)
    expect(document.querySelectorAll(`#${__BUTTON_STYLE_ID}`)).toHaveLength(1)
  })

  it('asChild merges props onto one custom element with no wrapper', async () => {
    const calls: string[] = []
    const { container, getByText } = render(ButtonAsChildHarness, {
      props: {
        parentClick: () => calls.push('button'),
        childClick: () => calls.push('child'),
      },
    })

    const anchor = getByText('Save link') as HTMLAnchorElement
    expect(container.children).toHaveLength(1)
    expect(container.querySelector('button')).toBeNull()
    expect(anchor.id).toBe('save-link')
    expect(anchor.className).toBe('iris-button parent child')
    expect(anchor.getAttribute('data-iris-button-variant')).toBe('solid')
    expect(anchor.style.color).toBe('blue')
    expect(anchor.style.background).toBe('black')

    await fireEvent.click(anchor)
    expect(calls).toEqual(['button', 'child'])
  })

  it('asChild disabled intercepts the child click', async () => {
    const childClick = vi.fn()
    const { getByText } = render(ButtonAsChildHarness, {
      props: { disabled: true, childClick },
    })

    await fireEvent.click(getByText('Save link'))
    expect(childClick).not.toHaveBeenCalled()
  })
})
