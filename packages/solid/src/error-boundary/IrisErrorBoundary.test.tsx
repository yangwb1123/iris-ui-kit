import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisErrorBoundary } from './IrisErrorBoundary'

afterEach(cleanup)

function Boom(props: { message?: string }): never {
  throw new Error(props.message ?? 'kaboom')
}

describe('IrisErrorBoundary', () => {
  it('renders the default fallback (role=alert, message) instead of crashing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container, getByText } = render(() => (
      <IrisErrorBoundary>
        <Boom message="explosion" />
      </IrisErrorBoundary>
    ))

    const region = container.querySelector('[data-iris-error-boundary]')
    expect(region).not.toBeNull()
    expect(region?.getAttribute('role')).toBe('alert')
    expect(getByText('explosion')).toBeTruthy()
    // retry button is present + i18n'd (falls back to English without a provider)
    expect(container.querySelector('[data-iris-error-boundary-retry]')?.textContent).toBe(
      'Try again',
    )
    spy.mockRestore()
  })

  it('falls back to the i18n default message when the error message is empty', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Empty = (): never => {
      throw new Error('')
    }
    const { container } = render(() => (
      <IrisErrorBoundary>
        <Empty />
      </IrisErrorBoundary>
    ))
    expect(container.querySelector('[data-iris-error-boundary-message]')?.textContent).toBe(
      'Something went wrong.',
    )
    spy.mockRestore()
  })

  it('calls onError with the caught error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    render(() => (
      <IrisErrorBoundary onError={onError}>
        <Boom message="logged" />
      </IrisErrorBoundary>
    ))
    expect(onError).toHaveBeenCalledTimes(1)
    const arg = onError.mock.calls[0][0]
    expect(arg).toBeInstanceOf(Error)
    expect((arg as Error).message).toBe('logged')
    spy.mockRestore()
  })

  it('reset() lets a now-fixed child render again', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const [broken, setBroken] = createSignal(true)

    const Child = () => {
      if (broken()) throw new Error('still broken')
      return <div data-testid="ok">recovered</div>
    }

    const { container, getByText, queryByTestId } = render(() => (
      <IrisErrorBoundary>
        <Child />
      </IrisErrorBoundary>
    ))

    // initially the fallback is shown
    expect(container.querySelector('[data-iris-error-boundary]')).not.toBeNull()
    expect(queryByTestId('ok')).toBeNull()

    // fix the underlying cause, then reset
    setBroken(false)
    fireEvent.click(container.querySelector('[data-iris-error-boundary-retry]')!)

    expect(container.querySelector('[data-iris-error-boundary]')).toBeNull()
    expect(getByText('recovered')).toBeTruthy()
    spy.mockRestore()
  })

  it('passes { error, reset } to a custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let received: { error: unknown; reset: () => void } | undefined

    const { getByText } = render(() => (
      <IrisErrorBoundary
        fallback={(fb) => {
          received = fb
          return <div data-testid="custom">custom: {(fb.error as Error).message}</div>
        }}
      >
        <Boom message="for custom" />
      </IrisErrorBoundary>
    ))

    expect(getByText('custom: for custom')).toBeTruthy()
    expect(received).toBeDefined()
    expect((received!.error as Error).message).toBe('for custom')
    expect(typeof received!.reset).toBe('function')
    spy.mockRestore()
  })
})
