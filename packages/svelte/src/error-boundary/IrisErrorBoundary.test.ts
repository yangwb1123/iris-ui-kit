import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte'
import Harness from './Harness.svelte'
import CustomFallbackHarness from './CustomFallbackHarness.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisErrorBoundary', () => {
  it('renders children on the happy path (no error)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container, getByTestId } = render(Harness, { props: { shouldThrow: false } })
    expect(getByTestId('throwing-child-ok')).not.toBeNull()
    expect(container.querySelector('[data-iris-error-boundary]')).toBeNull()
    spy.mockRestore()
  })

  it('catches a child throw and shows the default fallback (role=alert, message visible) without crashing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(Harness, {
      props: { shouldThrow: true, message: 'kapow' },
    })

    await waitFor(() => {
      expect(container.querySelector('[data-iris-error-boundary]')).not.toBeNull()
    })
    const root = container.querySelector('[data-iris-error-boundary]')!
    expect(root.getAttribute('role')).toBe('alert')
    expect(container.querySelector('[data-iris-error-boundary-message]')!.textContent).toContain(
      'kapow',
    )
    // retry button present + labelled via i18n (English fallback)
    const retry = container.querySelector('[data-iris-error-boundary-retry]')!
    expect(retry.textContent).toContain('Try again')
    // the throwing child's success markup is gone
    expect(container.querySelector('[data-testid="throwing-child-ok"]')).toBeNull()
    spy.mockRestore()
  })

  it('falls back to the i18n message when the thrown error message is empty', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(Harness, { props: { shouldThrow: true, message: '' } })

    await waitFor(() => {
      expect(container.querySelector('[data-iris-error-boundary-message]')).not.toBeNull()
    })
    expect(container.querySelector('[data-iris-error-boundary-message]')!.textContent).toContain(
      'Something went wrong.',
    )
    spy.mockRestore()
  })

  it('invokes onError with the caught error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    render(Harness, { props: { shouldThrow: true, message: 'logged', onError } })

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    const err = onError.mock.calls[0]![0]
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('logged')
    spy.mockRestore()
  })

  it('reset() lets a now-fixed child render again', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container, rerender } = render(Harness, {
      props: { shouldThrow: true, message: 'transient' },
    })

    await waitFor(() => {
      expect(container.querySelector('[data-iris-error-boundary]')).not.toBeNull()
    })

    // "fix" the child, then click retry — the boundary re-attempts rendering.
    await rerender({ shouldThrow: false, message: 'transient' })
    const retry = container.querySelector('[data-iris-error-boundary-retry]')!
    await fireEvent.click(retry)

    await waitFor(() => {
      expect(container.querySelector('[data-testid="throwing-child-ok"]')).not.toBeNull()
    })
    expect(container.querySelector('[data-iris-error-boundary]')).toBeNull()
    spy.mockRestore()
  })

  it('renders a custom fallback snippet receiving { error, reset }', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container, getByTestId } = render(CustomFallbackHarness, {
      props: { message: 'custom-msg' },
    })

    await waitFor(() => {
      expect(container.querySelector('[data-testid="custom-fallback"]')).not.toBeNull()
    })
    expect(getByTestId('custom-error-message').textContent).toContain('custom-msg')
    // the default fallback must NOT render when a custom one is supplied
    expect(container.querySelector('[data-iris-error-boundary]')).toBeNull()
    // reset is a function wired to the snippet's button
    expect(getByTestId('custom-reset')).not.toBeNull()
    spy.mockRestore()
  })
})
