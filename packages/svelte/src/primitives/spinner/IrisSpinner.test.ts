import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisSpinner from './IrisSpinner.svelte'
import { __resetSpinnerStyles } from './styles'

afterEach(() => {
  cleanup()
  __resetSpinnerStyles()
})

describe('@iris-ui/svelte IrisSpinner', () => {
  it('renders a span with role=status', () => {
    const { container } = render(IrisSpinner)
    const el = container.querySelector('[data-iris-spinner-wrap]')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('role')).toBe('status')
  })

  it('renders an SVG with the spinner data attribute', () => {
    const { container } = render(IrisSpinner)
    expect(container.querySelector('[data-iris-spinner]')).not.toBeNull()
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('renders visually-hidden label text by default', () => {
    const { container } = render(IrisSpinner)
    expect(container.textContent).toContain('Loading')
  })

  it('installs styles once', () => {
    render(IrisSpinner)
    render(IrisSpinner)
    expect(document.querySelectorAll('#iris-spinner-styles')).toHaveLength(1)
  })
})
