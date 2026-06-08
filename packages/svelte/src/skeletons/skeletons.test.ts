import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisLoginTemplate from './IrisLoginTemplate.svelte'

describe('IrisLoginTemplate', () => {
  it('renders the login form', () => {
    const { container } = render(IrisLoginTemplate)
    expect(container.querySelector('[data-iris-login-form]')).toBeTruthy()
    expect(container.querySelector('[data-iris-login-submit]')).toBeTruthy()
  })

  it('shows error when provided', () => {
    const { container } = render(IrisLoginTemplate, { props: { error: 'Invalid credentials' } })
    expect(container.querySelector('[data-iris-login-error]')).toBeTruthy()
    expect(container.querySelector('[data-iris-login-error]')!.textContent).toContain(
      'Invalid credentials',
    )
  })

  it('shows custom submit label', () => {
    const { container } = render(IrisLoginTemplate, { props: { submitLabel: 'Log in' } })
    const btn = container.querySelector('[data-iris-login-submit]')!
    expect(btn.textContent).toContain('Log in')
  })
})
