import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisErrorBoundary, type IrisErrorBoundaryFallbackProps } from './ErrorBoundary'

afterEach(() => cleanup())

/** A child that throws on render when `boom` is true. */
function Boom({
  boom,
  message = 'kaboom',
}: {
  boom: boolean
  message?: string
}): React.ReactElement {
  if (boom) throw new Error(message)
  return <div data-ok="">fine</div>
}

describe('@iris-ui-kit/react IrisErrorBoundary', () => {
  it('catches a thrown error and shows the default fallback (role=alert, message) without crashing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <IrisErrorBoundary>
        <Boom boom message="explode!" />
      </IrisErrorBoundary>,
    )

    const box = container.querySelector('[data-iris-error-boundary]')
    expect(box).not.toBeNull()
    expect(box?.getAttribute('role')).toBe('alert')
    expect(container.querySelector('[data-iris-error-boundary-message]')?.textContent).toBe(
      'explode!',
    )
    expect(container.querySelector('[data-iris-error-boundary-retry]')?.textContent).toBe(
      'Try again',
    )
    spy.mockRestore()
  })

  it('falls back to the i18n default message when the error message is empty', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <IrisErrorBoundary>
        <Boom boom message="" />
      </IrisErrorBoundary>,
    )
    expect(container.querySelector('[data-iris-error-boundary-message]')?.textContent).toBe(
      'Something went wrong.',
    )
    spy.mockRestore()
  })

  it('calls onError with the caught error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    render(
      <IrisErrorBoundary onError={onError}>
        <Boom boom message="logged" />
      </IrisErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect((onError.mock.calls[0][0] as Error).message).toBe('logged')
    spy.mockRestore()
  })

  it('reset() lets a now-fixed child render again', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Harness(): React.ReactElement {
      const [boom, setBoom] = React.useState(true)
      return (
        <IrisErrorBoundary
          fallback={({ reset }) => (
            <button
              data-fix=""
              onClick={() => {
                setBoom(false)
                reset()
              }}
            >
              fix
            </button>
          )}
        >
          <Boom boom={boom} />
        </IrisErrorBoundary>
      )
    }

    const { container } = render(<Harness />)
    expect(container.querySelector('[data-fix]')).not.toBeNull()

    fireEvent.click(container.querySelector('[data-fix]')!)

    expect(container.querySelector('[data-ok]')?.textContent).toBe('fine')
    spy.mockRestore()
  })

  it('passes { error, reset } to a custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let received: IrisErrorBoundaryFallbackProps | null = null
    const { container } = render(
      <IrisErrorBoundary
        fallback={(props) => {
          received = props
          return <div data-custom-fallback="">{props.error.message}</div>
        }}
      >
        <Boom boom message="custom-path" />
      </IrisErrorBoundary>,
    )

    expect(container.querySelector('[data-custom-fallback]')?.textContent).toBe('custom-path')
    expect(received).not.toBeNull()
    expect(received!.error.message).toBe('custom-path')
    expect(typeof received!.reset).toBe('function')
    spy.mockRestore()
  })
})
